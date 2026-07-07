// =============================================================================
// Truesight | Cloud governance platform — PRODUCTION CI/CD
// Next.js 16 (standalone) -> ECR (arcane-prod/truesight, PROD account) -> ECS Fargate
// (truesight-prod-cluster). Auto-triggered by GitHub push; only `main` deploys.
// Mirrors the estate pattern in jenkinsfiles/Jenkinsfile.nr-frontend.
// =============================================================================
@Library('cwt-jenkins-library') _

// GitHub push webhook trigger.
properties([ pipelineTriggers([ [$class: 'GitHubPushTrigger'] ]) ])

pipeline {
    agent { label 'docker' }

    options {
        timeout(time: 40, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
        ansiColor('xterm')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        AWS_REGION   = 'ap-south-1'
        SERVICE_NAME = 'truesight'
        PROJECT      = 'truesight'
        STACK        = 'node'
        CLUSTER      = 'truesight-prod-cluster'
        APP_HOST     = 'truesight.arcane.tech'
        // Truesight owns its ECR in the PROD account (404063516552) — override the
        // library's default management-account registry via explicit `repo`.
        ECR_REPO     = '404063516552.dkr.ecr.ap-south-1.amazonaws.com/arcane-prod/truesight'
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Install') {
            steps { sh 'npm ci --no-audit --no-fund' }
        }

        stage('Lint & Typecheck') {
            steps {
                sh 'npm run lint'
                sh 'npx --no-install tsc --noEmit'
            }
        }

        stage('Build') {
            steps {
                // Early build validation (the shippable image is built in the
                // Docker stage against the same standalone output).
                // `next build` collects page data by importing every route; the
                // Drizzle client (@/db) validates DATABASE_URL at import. postgres.js
                // connects lazily, so this build-only placeholder is never dialed —
                // it mirrors the Dockerfile's build ENV. Runtime uses the real SSM value.
                sh "DATABASE_URL=postgres://build:build@127.0.0.1:5432/build NEXT_PUBLIC_APP_URL=https://${APP_HOST} NEXT_TELEMETRY_DISABLED=1 npm run build"
            }
        }

        stage('Deploy (ECS)') {
            when { branch 'main' }
            steps {
                // Single library step does the full prod deploy on its own docker node:
                // assume-role into the prod account (404063516552), build the image
                // from the Dockerfile, push to the isolated prod ECR, then image-swap
                // the running task definition (env/secrets stay Terraform-owned — no
                // drift) and force a new deployment, waiting for it to stabilise.
                //
                // We deliberately do NOT use a separate cwtDockerBuildPush stage: that
                // step only authenticates to the central management-account registry
                // (Constants.ECR_REGISTRY) and cannot push to Truesight's prod-account ECR.
                // cwtEcsDeploy resolves the prod ECR account itself and assumes the org
                // role before login/push/deploy — matching every other prod service.
                cwtEcsDeploy(
                    service_name:  env.SERVICE_NAME,
                    cluster:       env.CLUSTER,
                    project:       env.PROJECT,
                    stack:         env.STACK,
                    environment:   'prod',
                    repo:          env.ECR_REPO,
                    dockerfile:    'Dockerfile',
                    build_args:    "NEXT_PUBLIC_APP_URL=https://${env.APP_HOST}",
                    use_appconfig: false
                )
            }
        }

        stage('Build & Push Sync Image') {
            when { branch 'main' }
            steps {
                // The auto-refresh scheduled task (EventBridge → Fargate, owned by
                // Terraform: deploy/terraform/scheduled-sync.tf) runs a SEPARATE toolbox
                // image — Dockerfile.sync: node + tsx + the three estate sync CLIs —
                // pushed to the isolated prod ECR arcane-prod/truesight-sync:latest. Rebuilt on
                // every main deploy so the scheduled sync tracks the app's schema/adapters.
                // Same base-cred + assume-role@404 + ECR-login pattern cwtEcsDeploy uses
                // (agent runs in the management account; ECR lives in prod). Terraform owns
                // the task-def + rule; this only rolls the :latest (+ sha) image tag.
                withCredentials([usernamePassword(credentialsId: 'aws-management-credentials', usernameVariable: 'AWS_ACCESS_KEY_ID', passwordVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                    sh '''
                      set -e
                      REG=404063516552.dkr.ecr.ap-south-1.amazonaws.com
                      REPO=$REG/arcane-prod/truesight-sync
                      set +x
                      CREDS=$(aws sts assume-role --role-arn arn:aws:iam::404063516552:role/OrganizationAccountAccessRole --role-session-name truesight-sync-image --output json)
                      export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r .Credentials.AccessKeyId)
                      export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r .Credentials.SecretAccessKey)
                      export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r .Credentials.SessionToken)
                      set -x
                      aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin $REG
                      TAG=$(echo ${GIT_COMMIT:-latest} | cut -c1-8)
                      DOCKER_BUILDKIT=1 docker build --platform linux/amd64 -t $REPO:latest -t $REPO:$TAG -f Dockerfile.sync .
                      docker push $REPO:latest
                      docker push $REPO:$TAG
                    '''
                }
            }
        }

        // NOTE: no separate ECS Health Check stage. cwtEcsDeploy already waits for
        // services-stable and verifies running == desired inside the prod account
        // (assume-role). The library's cwtHealthCheck runs `aws ecs describe-services`
        // with the agent's management-account creds and cannot see the prod-account
        // cluster (ClusterNotFoundException), so the application-level Smoke Test below
        // — an authenticated-independent HTTPS hit to /api/health through the ALB — is
        // the post-deploy gate.

        stage('Smoke Test') {
            when { branch 'main' }
            steps {
                // Application-level: hit the live health route through the ALB/DNS.
                sh '''
                  set -e
                  echo "--- Smoke test https://${APP_HOST}/api/health ---"
                  for i in $(seq 1 10); do
                    CODE=$(curl -sk -o /tmp/truesight_health.json -w '%{http_code}' --max-time 15 "https://${APP_HOST}/api/health" || echo 000)
                    echo "attempt $i -> HTTP ${CODE}"
                    if [ "${CODE}" = "200" ]; then
                      cat /tmp/truesight_health.json
                      echo "Smoke test passed."
                      exit 0
                    fi
                    sleep 15
                  done
                  echo "ERROR: /api/health did not return 200 after retries."
                  exit 1
                '''
            }
        }
    }

    post {
        success { echo "OK: ${env.SERVICE_NAME} deployed (${env.BRANCH_NAME}) @ ${env.GIT_COMMIT?.take(8)}" }
        failure { echo "FAIL: ${env.SERVICE_NAME} branch=${env.BRANCH_NAME}" }
        always  { cleanWs(deleteDirs: true, notFailBuild: true) }
    }
}
