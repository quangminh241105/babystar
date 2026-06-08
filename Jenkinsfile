pipeline {
    agent any

    environment {
        TARGET_SERVER = '192.168.1.199'
        TARGET_USER = 'deployer'

        APP_NAME = 'babystar'
        APP_PORT = '9000'

        DEPLOY_PATH = '/opt/webapps/babystar'
    }

    triggers {
        githubPush()
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Verify Files') {
            steps {
                sh '''
                    echo "=== Jenkins Build Info ==="

                    pwd
                    ls -la

                    if [ ! -f package.json ]; then
                        echo "ERROR: package.json missing"
                        exit 1
                    fi
                    
                    if [ ! -f Dockerfile ]; then
                        echo "ERROR: Dockerfile missing"
                        exit 1
                    fi

                    echo "Git commit:"
                    git log -1 --oneline
                '''
            }
        }

        stage('Deploy Files') {
            steps {
                sshagent(['ubuntu-vm-jenkins']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_SERVER} "
                            mkdir -p ${DEPLOY_PATH}
                        "

                        rsync -avz --delete \
                            --exclude '.git' \
                            --exclude 'node_modules' \
                            --exclude '.env' \
                            --exclude '*.log' \
                            ./ ${TARGET_USER}@${TARGET_SERVER}:${DEPLOY_PATH}/
                    '''
                }
            }
        }

        stage('Inject .env from Jenkins') {
            steps {
                withCredentials([file(credentialsId: 'babystar-env', variable: 'ENV_FILE')]) {
                    sshagent(['ubuntu-vm-jenkins']) {
                        sh '''
                            scp -o StrictHostKeyChecking=no $ENV_FILE ${TARGET_USER}@${TARGET_SERVER}:${DEPLOY_PATH}/.env
                        '''
                    }
                }
            }
        }

        stage('Build & Start Application') {
            steps {
                sshagent(['ubuntu-vm-jenkins']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "
                            cd ${DEPLOY_PATH}

                            echo 'Building Docker image...'
                            docker build -t ${APP_NAME}:latest .

                            echo 'Stopping old container...'
                            docker stop ${APP_NAME} || true
                            docker rm ${APP_NAME} || true

                            echo 'Starting ${APP_NAME} in Docker...'
                            docker run -d \\
                                --name ${APP_NAME} \\
                                -p ${APP_PORT}:${APP_PORT} \\
                                --env-file .env \\
                                --restart unless-stopped \\
                                ${APP_NAME}:latest
                            
                            docker ps | grep ${APP_NAME}
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(['ubuntu-vm-jenkins']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "
                            echo 'Waiting for application to start...'
                            
                            for i in {1..12}; do
                                if curl -s -f -L http://localhost:${APP_PORT} > /dev/null 2>&1; then
                                    echo '✓ babystar healthy'
                                    exit 0
                                fi
                                echo \"Attempt \$i failed. Waiting 5s...\"
                                sleep 5
                            done

                            echo '✗ Health check failed after 60 seconds'
                            docker logs ${APP_NAME} --tail 50
                            exit 1
                        "
                    '''
                }
            }
        }
    }

    post {

        success {
            echo 'Deployment successful'
            echo 'babystar running on 192.168.1.199:9000'
            echo 'Domain: https://babystar.mom'
        }

        failure {
            echo 'Deployment failed'
        }

        always {
            cleanWs()
        }
    }
}
