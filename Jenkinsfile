pipeline {
    agent any
    
    environment {
        SEPM_SERVER = '172.31.31.101'
        SEPM_USER = 'deployer'
        DEPLOY_PATH = '/opt/myapp'
        APP_NAME = 'myapp'
        APP_PORT = '9000'
        PID_FILE = '/opt/myapp/app.pid'
    }
    
    triggers {
        githubPush()
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code from GitHub...'
                checkout scm
            }
        }
        
        stage('Display Info') {
            steps {
                sh '''
                    echo "=== Jenkins Server Info ==="
                    echo "Current directory:"
                    pwd
                    echo "Files to deploy:"
                    ls -la
                    echo "Git commit:"
                    git log -1 --oneline
                '''
            }
        }
        
        stage('Deploy to SEPM Server') {
            steps {
                echo 'Deploying to SEPM server...'
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        # Safety check: verify we have package.json
                        if [ !  -f "package.json" ]; then
                            echo "❌ ERROR: package.json not found!  Wrong directory?"
                            exit 1
                        fi
                        
                        echo "✓ Safety check passed"
                        echo "Syncing from: $(pwd)"
                        
                        # Create directory on SEPM server
                        ssh -o StrictHostKeyChecking=no ${SEPM_USER}@${SEPM_SERVER} "mkdir -p ${DEPLOY_PATH}"
                        
                        # Sync code (NO space between .  and /)
                        rsync -avz \
                            --exclude node_modules \
                            --exclude .git \
                            --exclude '*.log' \
                            --exclude '*.pid' \
                            ./ ${SEPM_USER}@${SEPM_SERVER}:${DEPLOY_PATH}/
                        
                        echo "✓ Code synced to SEPM server"
                    '''
                }
            }
        }
        
        stage('Stop Existing Application') {
            steps {
                echo 'Stopping existing application on SEPM...'
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh deployer@172.31.31.101 "
                            # Kill using PID file
                            if [ -f /opt/myapp/app.pid ]; then
                                PID=\\$(cat /opt/myapp/app.pid)
                                if ps -p \\$PID > /dev/null 2>&1; then
                                    echo 'Stopping process '\\$PID
                                    kill -9 \\$PID 2>/dev/null || true
                                fi
                                rm -f /opt/myapp/app.pid
                            fi
                            
                            # Kill ANY process on port 9000
                            PID_ON_PORT=\\$(lsof -ti:9000 2>/dev/null || true)
                            if [ !  -z \\\"\\$PID_ON_PORT\\\" ]; then
                                echo 'Killing process on port 9000: '\\$PID_ON_PORT
                                kill -9 \\$PID_ON_PORT 2>/dev/null || true
                                sleep 2
                            fi
                            
                            # Double-check port is free
                            sleep 1
                            if lsof -ti:9000 > /dev/null 2>&1; then
                                echo 'Port 9000 still in use, forcing kill'
                                fuser -k 9000/tcp 2>/dev/null || true
                            fi
                            
                            echo '✓ Old application stopped'
                        "
                    '''
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo 'Installing npm dependencies on SEPM server...'
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh deployer@172.31.31.101 "
                            cd /opt/myapp
                            
                            if [ ! -f package.json ]; then
                                echo '❌ ERROR: No package.json in /opt/myapp'
                                exit 1
                            fi
                            
                            echo '=== SEPM Server Info ==='
                            echo 'Node version:'
                            node --version
                            echo 'NPM version:'
                            npm --version
                            
                            echo 'Installing dependencies...'
                            npm install
                            
                            echo '✓ Dependencies installed'
                        "
                    '''
                }
            }
        }
        
        stage('Start Application') {
            steps {
                echo 'Starting application on SEPM...'
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh deployer@172.31.31.101 "
                            cd /opt/myapp
                            
                            nohup npm run dev > /opt/myapp/app.log 2>&1 &
                            echo \\$! > /opt/myapp/app.pid
                            
                            echo 'Application started with PID: '\\$(cat /opt/myapp/app.pid)
                            sleep 3
                            
                            if ps -p \\$(cat /opt/myapp/app.pid) > /dev/null 2>&1; then
                                echo '✓ Application is running'
                            else
                                echo '✗ Failed to start'
                                tail -20 /opt/myapp/app.log
                                exit 1
                            fi
                        "
                    '''
                }
            }
        }
        
        stage('Health Check') {
            steps {
                echo 'Checking application health...'
                sshagent(['sepm-ssh-credentials']) {
                    sh '''
                        ssh deployer@172.31.31.101 "
                            sleep 5
                            
                            echo 'Testing application endpoint...'
                            
                            if curl -f -s -o /dev/null http://localhost:9000; then
                                echo '✓ Health check passed - application is responding'
                            else
                                echo '��� Health check failed - application not responding'
                                echo 'Recent logs:'
                                tail -30 /opt/myapp/app.log
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
            echo '✅ Deployment successful!'
            echo '🚀 Application running at http://172.31.31.101:9000'
            echo '🌐 Access via: https://babystar.mom'
        }
        failure {
            echo '❌ Deployment failed!'
        }
        always {
            cleanWs()
        }
    }
}