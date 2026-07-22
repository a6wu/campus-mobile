#!/bin/sh
set -e
echo "Start: post-publish.sh"
cd ./scripts/codemagic-ci
npm i
pip3 install --target=./python_modules -r requirements.txt

ENV_VARS=$( jq -n \
                  --arg fciBuildStepStatus "$FCI_BUILD_STEP_STATUS" \
                  --arg fciProjectId "$FCI_PROJECT_ID" \
                  --arg fciBuildId "$FCI_BUILD_ID" \
                  --arg appVersion "$APP_VERSION" \
                  --arg buildPlatform "$BUILD_PLATFORM" \
                  --arg buildNumber "$PROJECT_BUILD_NUMBER" \
                  --arg buildEnv "$BUILD_ENV" \
                  --argjson fciArtifactLinks "${CM_ARTIFACT_LINKS:-[]}" \
                  --arg buildBranch "$FCI_BRANCH" \
                  --arg commitHash "$FCI_COMMIT" \
                  --arg prNumber "$FCI_PULL_REQUEST_NUMBER" \
                  --arg msTeamsWebhookUrl "$MS_TEAMS_WEBHOOK_URL" \
                  --arg awsS3Bucket "$AWS_S3_BUCKET" \
                  --arg awsRegion "$AWS_REGION" \
                  --arg awsS3KeyPrefix "$AWS_S3_KEY_PREFIX" \
                  '{fciBuildStepStatus: $fciBuildStepStatus, fciProjectId: $fciProjectId, fciBuildId: $fciBuildId, appVersion: $appVersion, buildPlatform: $buildPlatform, buildNumber: $buildNumber, buildEnv: $buildEnv, fciArtifactLinks: $fciArtifactLinks, buildBranch: $buildBranch, commitHash: $commitHash, prNumber: $prNumber, msTeamsWebhookUrl: $msTeamsWebhookUrl, awsS3Bucket: $awsS3Bucket, awsRegion: $awsRegion, awsS3KeyPrefix: $awsS3KeyPrefix}' )

echo "Writing env-vars.json from \$ENV_VARS ..."
echo $ENV_VARS > env-vars.json

echo "Find build artifacts"
dsymPath=$(find $CM_BUILD_DIR/build/ios/archive/Runner.xcarchive -name "*.dSYM" | head -1)
if [[ -z ${dsymPath} ]]; then
  echo "No debug symbols were found, skip publishing to Firebase Crashlytics"
else
  echo "Publishing debug symbols from $dsymPath to Firebase Crashlytics"
  $CM_BUILD_DIR/ios/Pods/FirebaseCrashlytics/upload-symbols \
    -gsp $CM_BUILD_DIR/ios/Runner/GoogleService-Info.plist -p ios $dsymPath
fi

node ./build-notifier.js
echo "End: post-publish.sh"
