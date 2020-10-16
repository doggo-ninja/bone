module.exports = {
    appId: 'ninja.doggo.bone',
    productName: 'bone',
    copyright: 'Copyright © 2020 Felix Mattick',
    files: [
        'app.js',
        'web/',
        'LICENSE',
        'assets/menubar-Template.png',
        'assets/menubar-Template@2x.png'
    ],
    mac: {
        category: 'public.app-category.utilities',
        darkModeSupport: 'true',
        minimumSystemVersion: '10.13',
        hardenedRuntime: 'true'
    },
    win: {
        target: [ 'nsis' ]
    }
}