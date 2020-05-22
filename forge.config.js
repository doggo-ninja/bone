module.exports = {
    packagerConfig: {
        icon: 'build/icon.icns'
    },
    makers: [
        {
            name: '@electron-forge/maker-dmg',
            config: {
                background: 'build/bacc.jpg',
                iconSize: 84,
                icon: 'build/icon.icns',
                format: 'UDBZ',
                contents: (opts) => [
                    {
                        x: 240,
                        y: 296,
                        type: 'file',
                        path: opts.appPath
                    },
                    {
                        x: 620,
                        y: 290,
                        type: 'link',
                        path: '/Applications'
                    }
                ]
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
    ]
}