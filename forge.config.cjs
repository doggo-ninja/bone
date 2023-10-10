/*
module.exports = {
	osxSigningCert: 'Developer ID Application: Firstname Lastname (XXXXXXXXXX)',
	osxInstallerCert: 'Developer ID Installer: Firstname Lastname (XXXXXXXXXX)',
	appleId: 'firstname.lastname@example.com',
	appleIdPassword: 'xxxx-xxxx-xxxx-xxxx-xxxx'
}
*/
const credentials = require('./.credentials.cjs')

const fs = require('fs')

module.exports = {
    packagerConfig: {
        icon: 'build/icon.icns',
        appBundleId: 'ninja.doggo.bone',
        osxSign: {
            identity: credentials.osxSigningCert,
            entitlements: 'build/entitlements.plist',
            'hardened-runtime': true,
            'gatekeeper-assess': false,
            'entitlements-inherit': 'build/entitlements.plist',
            'signature-flags': 'library',
        },
        osxNotarize: {
            appleId: credentials.appleId,
            appleIdPassword: credentials.appleIdPassword
        }
    },
    makers: [
        {
            name: '@electron-forge/maker-pkg',
            config: {
                identity: credentials.osxInstallerCert
            }
        },
        {
            name: '@electron-forge/maker-zip'
        }
    ],
    hooks: {
        postMake: (_, results) => {
            return results.map((result) => ({
                ...result,
                artifacts: result.artifacts.map((artifact) => {
                    if (artifact.endsWith('.zip')) {
                        const newArtifact = artifact.replace(`zip/${result.platform}/${result.arch}`, '')
                        fs.renameSync(artifact, newArtifact)
                        return newArtifact
                    } else if (artifact.endsWith('.pkg')) {
                        const newArtifact = artifact.replace(
                            `${result.packageJSON.name}-${result.packageJSON.version}-${result.arch}`,
                            `${result.packageJSON.name} v${result.packageJSON.version} (${result.arch})`
                        )
                        fs.renameSync(artifact, newArtifact)
                        return newArtifact
                    } else {
                        return artifact
                    }
                })
            }))
        }
    }
}