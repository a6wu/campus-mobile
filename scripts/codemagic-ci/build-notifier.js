const fetch = require('node-fetch')
const AbortController = require('abort-controller')
const moment = require('moment')
const fs = require('fs')
const XlsxTemplate = require('xlsx-template')
const ENV_VARS = require('./env-vars.json')

const INTERNAL_TIMEOUT = 20000
const finalBuildNumber = parseInt(ENV_VARS.buildNumber) + 1000
const teamsWebhookUrl = ENV_VARS.msTeamsWebhookUrl

const getStringValue = (value) => (value === undefined || value === null) ? '' : String(value)
const TEST_PLAN_PRESIGNED_URL_EXPIRES_SECONDS = 15 * 24 * 60 * 60

const sanitizeS3KeyPart = (value) => getStringValue(value)
	.replace(/[^a-zA-Z0-9._=-]+/g, '-')
	.replace(/^-+|-+$/g, '')

const buildTestPlanS3Key = (fileName) => {
	const keyPrefix = getStringValue(ENV_VARS.awsS3KeyPrefix || 'codemagic-test-plans').replace(/^\/+|\/+$/g, '')
	const buildSource = ENV_VARS.prNumber ? 'PR-' + ENV_VARS.prNumber : ENV_VARS.buildBranch
	return [
		keyPrefix,
		sanitizeS3KeyPart(ENV_VARS.buildEnv),
		sanitizeS3KeyPart(buildSource),
		fileName,
	].filter(Boolean).join('/')
}

const uploadTestPlanToS3 = (testPlanFilename) => {
	try {
		if (!testPlanFilename) {
			console.log('S3 upload skipped: test plan filename unavailable')
			return null
		}

		if (!ENV_VARS.awsS3Bucket) {
			console.log('S3 upload skipped: AWS_S3_BUCKET unavailable')
			return null
		}

		const uploadOptions = {
			bucket: ENV_VARS.awsS3Bucket,
			region: ENV_VARS.awsRegion,
			key: buildTestPlanS3Key(testPlanFilename),
			filePath: testPlanFilename,
			fileName: testPlanFilename,
			expiresIn: TEST_PLAN_PRESIGNED_URL_EXPIRES_SECONDS,
		}

		console.log('Uploading test plan to S3 bucket `' + uploadOptions.bucket + '` as `' + uploadOptions.key + '`...')
		const pythonProcess = spawnSync('python3', ['upload-test-plan-s3.py', JSON.stringify(uploadOptions)], { encoding: 'utf8' })

		if (pythonProcess.stderr) {
			console.log(pythonProcess.stderr)
		}

		if (pythonProcess.status != 0) {
			console.log('Uploading test plan to S3 failed')
			if (pythonProcess.stdout) {
				console.log(pythonProcess.stdout)
			}
			return null
		}

		const uploadResult = JSON.parse(pythonProcess.stdout)
		console.log('Uploading test plan to S3 succeeded')
		console.log('Test plan S3 object key: ' + uploadResult.key)
		return uploadResult
	} catch (err) {
		console.log(err)
		return null
	}
}


const getS3KeyPrefix = (defaultPrefix) => getStringValue(ENV_VARS.awsS3KeyPrefix || defaultPrefix).replace(/^\/+|\/+$/g, '')

const buildTemplateS3Key = (templateFilename) => [
	getS3KeyPrefix('codemagic-test-plans'),
	'Templates',
	templateFilename,
].filter(Boolean).join('/')

const downloadTestPlanTemplateFromS3 = (templateFilename) => {
	try {
		if (!ENV_VARS.awsS3Bucket) {
			throw 'Error: AWS_S3_BUCKET unavailable for test plan template download'
		}

		const downloadOptions = {
			bucket: ENV_VARS.awsS3Bucket,
			region: ENV_VARS.awsRegion,
			key: buildTemplateS3Key(templateFilename),
			destination: templateFilename,
		}

		console.log('Downloading test plan template from S3 bucket `' + downloadOptions.bucket + '` key `' + downloadOptions.key + '`...')
		const pythonProcess = spawnSync('python3', ['download-test-plan-template-s3.py', JSON.stringify(downloadOptions)], { encoding: 'utf8' })

		if (pythonProcess.stderr) {
			console.log(pythonProcess.stderr)
		}

		if (pythonProcess.status != 0) {
			if (pythonProcess.stdout) {
				console.log(pythonProcess.stdout)
			}
			throw 'Error: Downloading test plan template from S3 failed'
		}

		return templateFilename
	} catch (err) {
		throw err
	}
}

const getTestPlanTemplatePath = (planType, buildEnv, buildPlatform) => {
	const normalizedPlatform = buildPlatform === 'IOS' ? 'iOS' : 'Android'
	const normalizedEnv = ['PROD', 'PROD-TEST'].includes(buildEnv) ? buildEnv : 'QA'
	const templateFilename = planType === 'pr' ?
		'PR-Test-Plan-Template-' + normalizedPlatform + '-QA.xlsx' :
		'Regression-Test-Plan-Template-' + normalizedPlatform + '-' + normalizedEnv + '.xlsx'

	return downloadTestPlanTemplateFromS3(templateFilename)
}

const isUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value)

const findArtifactLink = (artifactLinks, artifactFilename) => {
	if (!artifactLinks || !artifactFilename) {
		return ''
	}

	const findUrlInValue = (value) => {
		if (!value) {
			return ''
		}

		if (typeof value === 'string') {
			return isUrl(value) && value.includes(artifactFilename) ? value : ''
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				const artifactUrl = findUrlInValue(item)
				if (artifactUrl) {
					return artifactUrl
				}
			}
			return ''
		}

		if (typeof value === 'object') {
			const objectValues = Object.values(value)
			const directUrl = objectValues.find((item) => isUrl(item) && item.includes(artifactFilename))
			if (directUrl) {
				return directUrl
			}

			const artifactName = objectValues.find((item) => typeof item === 'string' && item.includes(artifactFilename))
			if (artifactName) {
				const objectUrl = objectValues.find((item) => isUrl(item))
				if (objectUrl) {
					return objectUrl
				}
			}

			for (const item of objectValues) {
				const artifactUrl = findUrlInValue(item)
				if (artifactUrl) {
					return artifactUrl
				}
			}
		}

		return ''
	}

	return findUrlInValue(artifactLinks)
}

const createTeamsNotificationPayload = (title, facts, actions) => ({
	'type': 'message',
	'attachments': [
		{
			'contentType': 'application/vnd.microsoft.card.adaptive',
			'content': {
				'type': 'AdaptiveCard',
				'body': [
					{
						'type': 'TextBlock',
						'text': title,
						'weight': 'Bolder',
						'size': 'Medium',
						'wrap': true,
					},
					{
						'type': 'FactSet',
						'facts': facts.map((fact) => ({
							'title': fact.title,
							'value': getStringValue(fact.value),
						})),
					},
				],
				'actions': actions,
				'$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
				'version': '1.2',
			},
		},
	],
})

ENV_VARS.commitHash = ENV_VARS.commitHash.substring(0, 7)

const { spawnSync }  = require('child_process')

const buildNotify = async () => {
	try {
		const buildTimestamp = moment().format('YYYY-MM-DD h:mm A')
		const fciProjectLink = 'https://codemagic.io/app/' + ENV_VARS.fciProjectId + '/build/' + ENV_VARS.fciBuildId
		let buildSuccess = (ENV_VARS.fciBuildStepStatus === 'success') ? true : false
		let buildApkFile = 'app-release.apk'
		let prAuthor = ''
		let testPlanFilename = ''
		let testPlanUrl = ''

		console.log('ENV_VARS.fciBuildStepStatus: ' + ENV_VARS.fciBuildStepStatus)
		console.log('buildSuccess: ' + buildSuccess)
		console.log('buildPlatform: ' + ENV_VARS.buildPlatform)

		// Check build success
		if (buildSuccess) {
			// Supplemental GitHub metadata for PRs
			if (ENV_VARS.prNumber) {
				prAuthor = await githubMeta()
			}

			// Generate test plan
			;({ testPlanFilename, testPlanUrl } = await generateTestPlan(prAuthor))
		}

		const androidApkUrl = findArtifactLink(ENV_VARS.fciArtifactLinks, buildApkFile)
		const successEmojiList = ['🥇','🏆','🎖','🎉','🎊','🚀','🛫','🏋','💪','👏','💯']
		const failedEmojiList = ['🙀','😱','😵']
		let buildStatusText = ''

		// Build success or failure
		if (buildSuccess) {
			const successEmoji = successEmojiList[Math.floor(Math.random() * successEmojiList.length)]
			buildStatusText = 'BUILD SUCCESS ' + successEmoji
		} else {
			const failedEmoji = failedEmojiList[Math.floor(Math.random() * failedEmojiList.length)]
			buildStatusText = 'BUILD FAILED ' + failedEmoji
		}

		// Construct build notifier message
		const teamsFacts = [
			{ 'title': 'Version:', 'value': ENV_VARS.appVersion + ' (' + finalBuildNumber + ')' },
			{ 'title': 'Environment:', 'value': ENV_VARS.buildEnv },
		]
		const teamsActions = [
			{
				'type': 'Action.OpenUrl',
				'title': 'View CodeMagic Build',
				'url': fciProjectLink,
			},
		]

		// PR or Branch
		if (ENV_VARS.prNumber) {
			teamsFacts.push({ 'title': 'PR:', 'value': ENV_VARS.prNumber })
			teamsFacts.push({ 'title': 'Author:', 'value': prAuthor })
			teamsActions.push({
				'type': 'Action.OpenUrl',
				'title': 'View PR',
				'url': 'https://github.com/UCSD/campus-mobile/pull/' + ENV_VARS.prNumber,
			})
		} else {
			teamsFacts.push({ 'title': 'Branch:', 'value': ENV_VARS.buildBranch })
			teamsFacts.push({ 'title': 'Commit:', 'value': ENV_VARS.commitHash })
			teamsActions.push({
				'type': 'Action.OpenUrl',
				'title': 'View Commit',
				'url': 'https://github.com/UCSD/campus-mobile/commit/' + ENV_VARS.commitHash,
			})
		}

		// Build Artifacts
		if (ENV_VARS.buildPlatform === 'IOS') {
			teamsFacts.push({
				'title': 'iOS:',
				'value': 'TestFlight ' + ENV_VARS.appVersion + ' (' + finalBuildNumber + ')',
			})
			teamsActions.push({
				'type': 'Action.OpenUrl',
				'title': 'Open TestFlight',
				'url': 'https://mobile.ucsd.edu/testflight',
			})
		} else if (ENV_VARS.buildPlatform === 'ANDROID') {
			teamsFacts.push({
				'title': 'Android:',
				'value': androidApkUrl ? buildApkFile : 'N/A',
			})
			if (androidApkUrl) {
				teamsActions.push({
					'type': 'Action.OpenUrl',
					'title': 'Download Android APK',
					'url': androidApkUrl,
				})
			}
		}

		// Test plan
		if (testPlanUrl && testPlanFilename) {
			teamsFacts.push({ 'title': 'Testing:', 'value': testPlanFilename })
			teamsActions.push({
				'type': 'Action.OpenUrl',
				'title': 'Download Test Plan (expires in 15 days)',
				'url': testPlanUrl,
			})
		}

		teamsFacts.push({ 'title': 'Status:', 'value': buildStatusText })
		teamsFacts.push({ 'title': 'Time:', 'value': buildTimestamp })

		const teamsPayload = createTeamsNotificationPayload(
			'Campus Mobile Build Notifier',
			teamsFacts,
			teamsActions,
		)

		// Send notification via webhook integration
		console.log('Sending Teams notification for UC San Diego ' + ENV_VARS.appVersion + ' (' + finalBuildNumber + ')\n')
		if (ENV_VARS.buildPlatform === 'ANDROID' && androidApkUrl) {
			console.log('Android APK CodeMagic artifact URL: ' + androidApkUrl)
		}
		if (!teamsWebhookUrl) {
			throw 'Error: MS Teams webhook URL unavailable'
		}

		const notifyController = new AbortController()
		const notifyTimeout = setTimeout(() => { notifyController.abort() }, INTERNAL_TIMEOUT)
		const notifyResp = await fetch(teamsWebhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(teamsPayload),
			signal: notifyController.signal,
		})
		clearTimeout(notifyTimeout)

		if (!notifyResp.ok) {
			throw 'Error: Unable to POST to Teams webhook (status: ' + notifyResp.status + ' ' + notifyResp.statusText + ')'
		}
	} catch (err) {
		console.log(err)
		process.exitCode = 1
	}
}

const generateTestPlan = async (prAuthor) => {
	try {
		let testPlanFilename
		let testPlanUrl
		if (ENV_VARS.prNumber) {
			console.log('Generating test plan for PR ' + ENV_VARS.prNumber)
			testPlanFilename = 'PR-' + ENV_VARS.prNumber + '-Test-Plan-' + ENV_VARS.appVersion + '-' + ENV_VARS.buildEnv + '-' + finalBuildNumber + '.xlsx'
			console.log('  (1/3) Downloading PR test plan template from S3 ...')
			fs.copyFileSync(getTestPlanTemplatePath('pr', ENV_VARS.buildEnv, ENV_VARS.buildPlatform), testPlanFilename)
		} else {
			console.log('Generating regression test plan for branch ' + ENV_VARS.buildBranch)
			testPlanFilename = 'Regression-Test-Plan-' + ENV_VARS.appVersion + '-' + ENV_VARS.buildEnv + '-' + finalBuildNumber + '.xlsx'
			const regressionTemplateEnv = ['PROD', 'PROD-TEST'].includes(ENV_VARS.buildEnv) ? ENV_VARS.buildEnv : 'QA'
			console.log('  (1/3) Downloading ' + regressionTemplateEnv + ' regression test plan template from S3 ...')
			fs.copyFileSync(getTestPlanTemplatePath('regression', regressionTemplateEnv, ENV_VARS.buildPlatform), testPlanFilename)
		}

		console.log('  (2/4) Making replacements ...')
		const data = fs.readFileSync(testPlanFilename)
		const template = new XlsxTemplate(data)
		const sheetNumber = 1
		const values = {
			APP_VERSION: ENV_VARS.appVersion,
			BUILD_ENV: ENV_VARS.buildEnv,
			BUILD_NUMBER: finalBuildNumber,
			BUILD_BRANCH: ENV_VARS.buildBranch,
		}
		if (ENV_VARS.prNumber) {
			values.PR_AUTHOR = prAuthor
			values.PR_NUMBER = ENV_VARS.prNumber
		}

		template.substitute(sheetNumber, values)

		console.log('  (3/4) Writing ' + testPlanFilename)
		fs.writeFileSync(testPlanFilename, Buffer.from(
			template.generate({type: 'base64'}),
			'base64'
		))

		console.log('(4/4) Uploading test plan to S3 for build ' + finalBuildNumber)
		const testPlanUpload = uploadTestPlanToS3(testPlanFilename)
		if (testPlanUpload && testPlanUpload.url) {
			testPlanUrl = testPlanUpload.url
		}
		return {
			testPlanFilename: testPlanFilename,
			testPlanUrl: testPlanUrl,
		}
	} catch(err) {
		console.log(err)
		return null
	}
}

const githubMeta = async () => {
	try {
		console.log('Fetching GitHub metadata for PR ' + ENV_VARS.prNumber)
		const ghController = new AbortController()
		const ghTimeout = setTimeout(() => { ghController.abort() }, INTERNAL_TIMEOUT)
		const ghResp = await fetch('https://api.github.com/repos/UCSD/campus-mobile/pulls/' + ENV_VARS.prNumber, { signal: ghController.signal })
		const ghRespJson = await ghResp.json()
		clearTimeout(ghTimeout)
		return ghRespJson.user.login
	} catch (err) {
		console.log(err)
		return 'n/a'
	}
}

buildNotify()
