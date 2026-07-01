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
                sh "NEXT_PUBLIC_APP_URL=https://${APP_HOST} NEXT_TELEMETRY_DISABLED=1 npm run build"
            }
        }

        stage('Docker Build & Push') {
            when { branch 'main' }
            steps {
                script {
                    // Tags pushed: sha-<gitSHA8> + stable (prod). Returns the image tag.
                    env.IMAGE_TAG = cwtDockerBuildPush(
                        service_name: env.SERVICE_NAME,
                        environment:  'prod',
                        repo:         env.ECR_REPO,
                        dockerfile:   'Dockerfile',
                        build_args:   "NEXT_PUBLIC_APP_URL=https://${env.APP_HOST}"
                    )
                }
            }
        }

        stage('Deploy (ECS)') {
            when { branch 'main' }
            steps {
                // Registers a new task definition revision, updates the service
                // (--force-new-deployment) and waits for it to stabilise.
                cwtEcsDeploy(
                    service_name: env.SERVICE_NAME,
                    cluster:      env.CLUSTER,
                    project:      env.PROJECT,
                    stack:        env.STACK,
                    environment:  'prod',
                    repo:         env.ECR_REPO,
                    tag:          env.IMAGE_TAG
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
        success { echo "OK: ${env.SERVICE_NAME} deployed (${env.BRANCH_NAME}) tag=${env.IMAGE_TAG}" }
        failure { echo "FAIL: ${env.SERVICE_NAME} branch=${env.BRANCH_NAME}" }
        always  { cleanWs(deleteDirs: true, notFailBuild: true) }
    }
}
