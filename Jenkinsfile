pipeline {
    agent any

    options {
        // GitHub can deliver duplicate push events. Do not deploy two builds at once.
        disableConcurrentBuilds()
        quietPeriod(10)
    }

    environment {
        TARGET_SERVER = '192.168.1.199'
        TARGET_USER = 'deployer'
        DEPLOY_PATH = '/opt/webapps/babystar'
    }

    triggers { githubPush() }

    stages {
        stage('Checkout') { steps { checkout scm } }

        stage('Validate') {
            steps {
                sh '''
                    set -eu
                    docker version
                    docker run --rm \
                        -v "$WORKSPACE/apps/api:/workspace:ro" \
                        python:3.12-slim \
                        sh -ec '
                            rm -rf /tmp/babystar-api
                            cp -a /workspace /tmp/babystar-api
                            cd /tmp/babystar-api
                            python -m pip install --no-cache-dir -r requirements.txt
                            python -m compileall -q app alembic tests
                            python -m pytest -p no:cacheprovider
                        '
                '''
            }
        }

        stage('Deploy files') {
            steps {
                sshagent(['ubuntu-vm-jenkins']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_SERVER} "mkdir -p ${DEPLOY_PATH}"
                        ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_SERVER} "rm -rf ${DEPLOY_PATH}/server ${DEPLOY_PATH}/client ${DEPLOY_PATH}/dataset"
                        rsync -avz --delete --exclude '.git' --exclude '.env' --exclude '.active-color' --exclude '.deployed-state' --exclude '.gateway-nginx.conf' --exclude 'server/' --exclude 'client/' --exclude 'dataset/' --exclude '*.log' ./ ${TARGET_USER}@${TARGET_SERVER}:${DEPLOY_PATH}/
                    '''
                }
            }
        }

        stage('Inject environment') {
            steps {
                withCredentials([file(credentialsId: 'babystar-env', variable: 'ENV_FILE')]) {
                    sshagent(['ubuntu-vm-jenkins']) {
                        sh '''
                            scp -o StrictHostKeyChecking=no "$ENV_FILE" ${TARGET_USER}@${TARGET_SERVER}:${DEPLOY_PATH}/.env
                            ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_SERVER} "sed -i 's/\\r$//' ${DEPLOY_PATH}/.env"
                        '''
                    }
                }
            }
        }

        stage('Build and start') {
            steps {
                sshagent(['ubuntu-vm-jenkins']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "cd ${DEPLOY_PATH} && DEPLOY_COMMIT=${GIT_COMMIT} bash infra/deploy-blue-green.sh"
                    '''
                }
            }
        }

        stage('Health check') {
            steps {
                sshagent(['ubuntu-vm-jenkins']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "
                            for i in {1..12}; do
                                if curl -s -f http://localhost:9000/api/v1/health > /dev/null; then exit 0; fi
                                sleep 5
                            done
                            docker logs --tail 80 babystar-gateway
                            exit 1
                        "
                    '''
                }
            }
        }
    }

    post {
        always { cleanWs() }
        success { echo 'BabyStar deployment succeeded.' }
        failure { echo 'BabyStar deployment failed.' }
    }
}
