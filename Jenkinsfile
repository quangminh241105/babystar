pipeline {
    agent any

    environment {
        TARGET_SERVER = '192.168.1.199'
        TARGET_USER = 'deployer'
        DEPLOY_PATH = '/opt/myapp'
        APP_NAME = 'myapp'
        APP_PORT = '9000'
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
                    echo "=== Build Info ==="
                    pwd
                    ls -la

                    if [ ! -f "package.json" ]; then
                        echo "ERROR: package.json not found"
                        exit 1
                    fi

                    echo "Latest commit:"
                    git log -1 --oneline
                '''
            }
        }

        stage('Deploy Files') {
            steps {
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        echo "Creating deployment directory..."

                        ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_SERVER} "
                            mkdir -p ${DEPLOY_PATH}
                        "

                        echo "Syncing files to target server..."

                        rsync -avz --delete \
                            --exclude '.git' \
                            --exclude 'node_modules' \
                            --exclude '.env' \
                            --exclude '*.log' \
                            ./ ${TARGET_USER}@${TARGET_SERVER}:${DEPLOY_PATH}/

                        echo "Deployment sync completed"
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "
                            cd ${DEPLOY_PATH}

                            echo 'Node version:'
                            node -v

                            echo 'NPM version:'
                            npm -v

                            npm ci
                        "
                    '''
                }
            }
        }

        stage('Start Application') {
            steps {
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "
                            cd ${DEPLOY_PATH}

                            echo 'Stopping old app if exists...'

                            pm2 delete ${APP_NAME} || true

                            echo 'Starting application...'

                            pm2 start npm \
                                --name ${APP_NAME} \
                                -- run dev

                            pm2 save

                            echo 'PM2 process list:'
                            pm2 list
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh ${TARGET_USER}@${TARGET_SERVER} "
                            sleep 5

                            echo 'Checking application health...'

                            if curl -f http://localhost:${APP_PORT} > /dev/null 2>&1; then
                                echo 'Application is healthy'
                            else
                                echo 'Health check failed'

                                echo 'Recent PM2 logs:'
                                pm2 logs ${APP_NAME} --lines 30 --nostream

                                exit 1
                            fi
                        "
                    '''
                }
            }
        }
    }

    post {

        success {
            echo 'Deployment successful'
            echo 'Application deployed to 192.168.1.199:9000'
        }

        failure {
            echo 'Deployment failed'
        }

        always {
            cleanWs()
        }
    }
}
