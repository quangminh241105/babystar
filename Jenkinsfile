pipeline {
    // Deployment runs against this machine's filesystem and Docker daemon.
    agent { label 'built-in || master' }

    options {
        // GitHub can deliver duplicate push events. Do not deploy two builds at once.
        disableConcurrentBuilds()
        quietPeriod(10)
    }

    environment {
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
                sh '''
                    set -eu
                    mkdir -p "$DEPLOY_PATH"
                    if [ ! -w "$DEPLOY_PATH" ]; then
                        echo "Jenkins cannot write to $DEPLOY_PATH; grant the Jenkins service user write access." >&2
                        exit 1
                    fi
                    rm -rf "$DEPLOY_PATH/server" "$DEPLOY_PATH/client" "$DEPLOY_PATH/dataset"
                    rsync -av --delete \
                        --exclude '.git' \
                        --exclude '.env' \
                        --exclude '.active-color' \
                        --exclude '.deployed-state' \
                        --exclude '.gateway-nginx.conf' \
                        --exclude '.gateway-nginx.conf.previous' \
                        --exclude 'server/' \
                        --exclude 'client/' \
                        --exclude 'dataset/' \
                        --exclude '*.log' \
                        ./ "$DEPLOY_PATH/"
                '''
            }
        }

        stage('Inject environment') {
            steps {
                withCredentials([file(credentialsId: 'babystar-env', variable: 'ENV_FILE')]) {
                    sh '''
                        set -eu
                        sed 's/\\r$//' "$ENV_FILE" > "$DEPLOY_PATH/.env.tmp"
                        chmod 600 "$DEPLOY_PATH/.env.tmp"
                        mv "$DEPLOY_PATH/.env.tmp" "$DEPLOY_PATH/.env"
                    '''
                }
            }
        }

        stage('Build and start') {
            steps {
                sh '''
                    set -eu
                    cd "$DEPLOY_PATH"
                    DEPLOY_COMMIT="$GIT_COMMIT" bash infra/deploy-blue-green.sh
                '''
            }
        }

        stage('Health check') {
            steps {
                sh '''
                    set -eu
                    for i in $(seq 1 12); do
                        if curl -fsS http://127.0.0.1:9000/api/v1/health >/dev/null && curl -fsS http://127.0.0.1:9000/ >/dev/null; then
                            exit 0
                        fi
                        sleep 5
                    done
                    docker logs --tail 80 babystar-gateway
                    exit 1
                '''
            }
        }
    }

    post {
        always { cleanWs() }
        success { echo 'BabyStar deployment succeeded.' }
        failure { echo 'BabyStar deployment failed.' }
    }
}
