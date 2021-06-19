const fs = require('fs')

if (process.env.NODE_ENV !== 'development' && !process.env.APPLE_ID_PASSWORD) {
    console.error('Please specify APPLE_ID_PASSWORD environment variable!')
    process.exit(1)
}

module.exports = {
    packagerConfig: {
        icon: 'build/icon.icns',
        appBundleId: 'ninja.doggo.bone',
        osxSign: {
            identity: 'Developer ID Application: Paul Mattick (LG65ZUW3QB)',
            entitlements: 'build/entitlements.plist',
            'hardened-runtime': true,
            'gatekeeper-assess': false,
            'entitlements-inherit': 'build/entitlements.plist',
            'signature-flags': 'library',
        },
        osxNotarize: {
            appleId: 'felix.mattick@gmail.com',
            appleIdPassword: process.env.APPLE_ID_PASSWORD
        }
    },
    makers: [
        {
            name: '@electron-forge/maker-pkg',
            config: {
                identity: 'Developer ID Installer: Paul Mattick (LG65ZUW3QB)'
            }
        }
    ],
    publishers: [
        {
            name: '@electron-forge/publisher-github',
            config: {
                repository: {
                    owner: 'kognise',
                    name: 'bone'
                },
                prerelease: true
            }
        }
    ],
    hooks: {
        postMake: (_, results) => {
            return results.map((result) => ({
                ...result,
                artifacts: result.artifacts.map((artifact) => {
                    const newArtifact = artifact.replace(
                        `${result.packageJSON.name}-${result.packageJSON.version}`,
                        `${result.packageJSON.name}-${result.packageJSON.version}-${result.arch}`
                    )
                    fs.renameSync(artifact, newArtifact)
                    return newArtifact
                })
            }))
        }
    }
}