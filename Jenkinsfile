// =============================================================================
// Argus | Cloud governance platform — PRODUCTION CI/CD
// Next.js 16 (standalone) -> ECR (cwt-prod/argus, PROD account) -> ECS Fargate
// (argus-prod-cluster). Auto-triggered by GitHub push; only `main` deploys.
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
        SERVICE_NAME = 'argus'
        PROJECT      = 'argus'
        STACK        = 'node'
        CLUSTER      = 'argus-prod-cluster'
        APP_HOST     = 'argus-infraspace.centricitywealth.tech'
        // Argus owns its ECR in the PROD account (404063516552) — override the
        // library's default management-account registry via explicit `repo`.
        ECR_REPO     = '404063516552.dkr.ecr.ap-south-1.amazonaws.com/cwt-prod/argus'
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
                // (Constants.ECR_REGISTRY) and cannot push to Argus's prod-account ECR.
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

        stage('Health Check') {
            when { branch 'main' }
            steps {
                // ECS-level: running count must equal desired count.
                cwtHealthCheck(cluster: env.CLUSTER, service: env.SERVICE_NAME)
            }
        }

        stage('Smoke Test') {
            when { branch 'main' }
            steps {
                // Application-level: hit the live health route through the ALB/DNS.
                sh '''
                  set -e
                  echo "--- Smoke test https://${APP_HOST}/api/health ---"
                  for i in $(seq 1 10); do
                    CODE=$(curl -sk -o /tmp/argus_health.json -w '%{http_code}' --max-time 15 "https://${APP_HOST}/api/health" || echo 000)
                    echo "attempt $i -> HTTP ${CODE}"
                    if [ "${CODE}" = "200" ]; then
                      cat /tmp/argus_health.json
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
