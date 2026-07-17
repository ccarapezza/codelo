@Library('westcode-shared') _

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 40, unit: 'MINUTES')      // Strapi + Next builds tardan más
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    booleanParam(
      name: 'SKIP_BUILD',
      defaultValue: false,
      description: 'DANGEROUS: skip `docker compose build` on the VPS. Use ONLY when redeploying with no code changes. Requires interactive confirmation.',
    )
  }

  stages {
    stage('Confirm SKIP_BUILD') {
      when { expression { params.SKIP_BUILD } }
      steps {
        timeout(time: 2, unit: 'MINUTES') {
          input(
            message: 'SKIP_BUILD is active. Deploy WITHOUT rebuilding images?',
            ok: 'Yes, skip build',
          )
        }
      }
    }

    stage('Deploy → cc-lab-contabo') {
      steps {
        deployDockerCompose([
          sshHost           : 'cc-lab-contabo',
          sshKeyCredentialId: 'westcode-cc-lab-deploy-ssh',
          gitBranch         : 'main',
          remoteDir         : '/opt/codelo',
          composeFile       : 'docker-compose.prod.yml',
          skipBuild         : params.SKIP_BUILD,
          nonSecretEnv: [
            POSTGRES_DB:             'codelo',
            POSTGRES_USER:           'codelo',
            // Public origins (domain TBD — update when the real domain lands)
            SITE_PUBLIC_URL:         'https://cogollosdeloeste.example',
            CMS_PUBLIC_URL:          'https://cms.cogollosdeloeste.example',
            // Strapi CORS allowlist + rate-limit defaults
            CORS_ALLOWED_ORIGINS:    'https://cogollosdeloeste.example',
            RATE_LIMIT_WINDOW_MS:    '60000',
            RATE_LIMIT_MAX:          '60',
          ],
          secrets: [
            POSTGRES_PASSWORD:           'codelo-postgres-password',
            STRAPI_APP_KEYS:             'codelo-strapi-app-keys',
            STRAPI_API_TOKEN_SALT:       'codelo-strapi-api-token-salt',
            STRAPI_ADMIN_JWT_SECRET:     'codelo-strapi-admin-jwt-secret',
            STRAPI_JWT_SECRET:           'codelo-strapi-jwt-secret',
            STRAPI_TRANSFER_TOKEN_SALT:  'codelo-strapi-transfer-token-salt',
            STRAPI_ENCRYPTION_KEY:       'codelo-strapi-encryption-key',
            INTERNAL_API_KEY:            'codelo-internal-api-key',
            REDIS_PASSWORD:              'codelo-redis-password',
            OPENAI_API_KEY:              'codelo-openai-api-key',
            OPENROUTER_API_KEY:          'codelo-openrouter-api-key',
          ],
          // codelo-web exposes /api/health for readiness checks.
        ])
      }
    }
  }
}
