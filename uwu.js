const FormData = require('form-data')
const chokidar = require('chokidar')
const pathLib = require('path')
const clipboardy = require('clipboardy')
const fs = require('fs')
const notifier = require('node-notifier')
const open = require('open')
const { default: fetch } = require('node-fetch')

const screenshotFolder = '/Users/kognise/Desktop/'
const token = 'FWZI0vJj2wW1F4i6qkb8QEuyj1dlAjF3mztXlXj6kNHQ9XoSNYY8hwq5ikku3TfHlGoCpofnvy1vjoBYdUzYKlLcFyfcvSRq4HwfKSAqSUuobDcptsq9Ql3Z1qqMKhGp'

chokidar.watch(screenshotFolder, { ignoreInitial: true }).on('add', async (path) => {
    const basename = pathLib.basename(path)

    if (/\.(png|jpe?g|gif)$/.test(basename) && !basename.startsWith('.')) {
        console.time('upload')
        console.log(`Uploading ${basename}...`)

        const form = new FormData()
        form.append('file', fs.createReadStream(path))
        console.timeLog('upload', 'make form')

        const res = await fetch('https://doggo.ninja/', {
            method: 'PUT',
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            },
            body: form
        })
        console.timeLog('upload', 'make put request')
        const json = await res.json()
        console.timeLog('upload', 'parse json')

        if (!json.url) {
            notifier.notify('An oopsie happened!')
            console.log('Something oopsie happened', json)
            return
        }

        await clipboardy.write(json.url)
        console.timeLog('upload', 'copy to clipboard')
        console.log(`${json.url} copied to clipboard`)

        fs.unlinkSync(path)
        notifier.notify({
            title: `Uploaded ${basename}`,
            message: 'The url has been copied to your clipboard.',
            icon: pathLib.join(__dirname, 'bone.png')
        }, (_, action) => {
            if (action === 'activate') open(json.url)
        })
        console.timeEnd('upload')
    }
})
