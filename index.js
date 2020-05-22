const Store = require('electron-store')
const { menubar } = require('menubar')
const { default: fetch } = require('node-fetch')
const { app, ipcMain, dialog, nativeTheme } = require('electron')
const FormData = require('form-data')
const chokidar = require('chokidar')
const pathLib = require('path')
const url = require('url')
const progress = require('progress-stream')
const fs = require('fs')

const store = new Store({
    defaults: {
        watchFolder: app.getPath('desktop')
    }
})

const initialState = {}
let state = initialState

const upload = async (path, update) => {
    const form = new FormData()
    form.append('file', fs.createReadStream(path))

    const stat = fs.statSync(path)
    const prog = progress({
        length: stat.size,
        time: 100
    })
    prog.on('progress', update)

    const res = await fetch('https://doggo.ninja/', {
        method: 'PUT',
        headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${store.get('token')}`
        },
        body: form.pipe(prog)
    })
    const json = await res.json()

    if (!json.url) {
        throw new Error(json.message || 'Something bad happened while trying to upload')
    }
    return json
}

const mb = menubar({
    index: url.format({
        protocol: 'file',
        slashes: true,
        pathname: pathLib.join(__dirname, 'web', 'index.html')
    }),
    icon: pathLib.join(__dirname, 'assets', 'menubar-Template.png'),
    browserWindow: {
        webPreferences: {
            nodeIntegration: true
        },
        backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff'
    }
})

mb.on('ready', () => {
    mb.tray.on('drop-files', (_, files) => {
        if (this._blurTimeout) clearInterval(this._blurTimeout)
        
        mb._isVisible = true
        mb.showWindow()

        ipcMain.emit('drop', null, JSON.stringify({
            path: files[0]
        }))
    })
    
    console.log('app is ready')
})

ipcMain.on('state', (_, raw) => {
    const message = JSON.parse(raw)
    state = message
})

ipcMain.on('configure', (_, raw) => {
    const message = JSON.parse(raw)
    store.set('token', message.token)
    store.set('watchFolder', message.watchFolder)

    mb.window.webContents.send('state', {
        mode: 'idle'
    })
})

ipcMain.on('app-upload', async () => {
    const { filePaths } = await dialog.showOpenDialog({ properties: [ 'openFile' ] })
    if (filePaths.length === 0) return
    ipcMain.emit('drop', null, JSON.stringify({
        path: filePaths[0]
    }))
})

ipcMain.on('drop', async (_, raw) => {
    const { path } = JSON.parse(raw)

    try {
        const { fileName, url } = await upload(path, (progress) => {
            mb.window.webContents.send('state', {
                mode: 'uploading',
                name: pathLib.basename(path),
                progress
            })
        })
        
        mb.window.webContents.send('state', {
            mode: 'uploaded',
            name: pathLib.basename(path),
            shortName: fileName,
            url
        })
    } catch (error) {
        mb.window.webContents.send('state', {
            mode: 'upload-error',
            message: error.message,
            name: pathLib.basename(path)
        })
    }
})

ipcMain.on('quit', () => app.quit())
ipcMain.on('logout', () => {
    store.delete('token')
    store.reset('watchFolder')

    mb.window.webContents.send('state', {
        mode: 'unconfigured',
        watchFolder: store.get('watchFolder') || '',
        token: store.get('token') || ''
    })
})

ipcMain.on('ready', () => {
    if (state === initialState) {
        if (store.get('watchFolder') && store.get('token')) {
            mb.window.webContents.send('state', { mode: 'idle' })
        } else {
            mb.window.webContents.send('state', {
                mode: 'unconfigured',
                watchFolder: store.get('watchFolder') || '',
                token: store.get('token') || ''
            })
        }
    } else {
        mb.window.webContents.send('state', state)
    }
})