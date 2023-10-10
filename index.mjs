import Store from 'electron-store'
import { menubar } from 'menubar'
import { default as fetch } from 'node-fetch'
import { app, ipcMain, dialog, nativeTheme, shell, clipboard, Notification } from 'electron'
import { watch } from 'chokidar'
import { basename as _basename, join } from 'path'
import { format } from 'url'
import progress from 'progress-stream'
import { statSync, createReadStream, readdirSync, unlink } from 'fs'
import updater from 'update-electron-app'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

updater()
app.setLoginItemSettings({ openAtLogin: process.env.NODE_ENV !== 'development' })

const store = new Store({
    defaults: {
        watchFolder: app.getPath('desktop')
    }
})

const upload = async (path, update = () => {}) => {
    const stat = statSync(path)
    const prog = progress({
        length: stat.size,
        time: 100
    })
    prog.on('progress', update)

    const res = await fetch(`https://pat.doggo.ninja/v1/upload?originalName=${encodeURIComponent(_basename(path))}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${store.get('token')}`,
            'Content-Type': 'application/octet-stream'
        },
        body: createReadStream(path)
    })
    const json = await res.json()

    if (!json.url) {
        throw new Error(json.message || 'Uh oh...')
    }
    return json
}

app.on('ready', () => {
    try {
        readdirSync(store.get('watchFolder'))
    } catch {
        if (process.platform === 'darwin') {
            dialog.showMessageBoxSync({
                type: 'error',
                title: 'No FS Access!',
                message: 'Looks like we can\'t access your filesystem.',
                detail: 'Have you added Bone in System Preferences > Security & Privacy > Full Disk Access?'
            })
            return app.quit()
        } else {
            store.delete('token')
            store.reset('watchFolder')
        }
    }

    const mb = menubar({
        index: format({
            protocol: 'file',
            slashes: true,
            pathname: join(__dirname, 'web', 'index.html')
        }),
        icon: join(__dirname, 'assets', 'menubar-Template.png'),
        browserWindow: {
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff'
        },
        showOnAllWorkspaces: false, // doesn't work, see https://github.com/maxogden/menubar/pull/442
        showDockIcon: false
    })

    mb.on('after-create-window', () => {
        mb.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
    })

    const initialState = {}
    let state = initialState

    let watcher
    let curWatchFolder

    const updateWatcher = () => {
        const newWatchFolder = store.get('watchFolder')
        if (newWatchFolder === curWatchFolder) return
        curWatchFolder = newWatchFolder
        if (watcher) watcher.close()
        if (!curWatchFolder.trim()) return

        console.log(`watching ${store.get('watchFolder')}`)

        watcher = watch(curWatchFolder, { ignoreInitial: true, depth: 0 }).on('add', async (path) => {
            if (!store.get('token')) return
            const basename = _basename(path)
        
            if (/\.(png|jpe?g|gif)$/.test(basename) && !basename.startsWith('.')) {
                console.log(`uploading ${basename}...`)

                try {
                    const json = await upload(path)

                    clipboard.write({
                        text: json.url,
                        html: `<a href='${json.url}'>${json.url}</a>`,
                        bookmark: basename
                    })

                    clipboard.write({
                        text: json.url,
                        html: `<a href='${json.url}'>${json.url}</a>`,
                        bookmark: basename
                    })
            
                    const notification = new Notification({
                        title: `Uploaded ${basename}`,
                        body: 'The url has been copied to your clipboard',
                        urgency: 'low',
                        sound: 'submarine'
                    })
                    notification.on('click', () => shell.openExternal(json.url))
                    notification.show()
            
                    unlink(path, () => {})
                } catch (error) {
                    const notification = new Notification({
                        title: 'An error occurred during upload!',
                        body: error.message,
                        urgency: 'critical'
                    })
                    notification.show()
                }
            }
        })
    }

    store.onDidChange('watchFolder', updateWatcher)
    updateWatcher()

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
            const { shortName, url } = await upload(path, (progress) => {
                mb.window.webContents.send('state', {
                    mode: 'uploading',
                    name: _basename(path),
                    progress
                })
            })
            
            mb.window.webContents.send('state', {
                mode: 'uploaded',
                name: _basename(path),
                shortName,
                url
            })
        } catch (error) {
            mb.window.webContents.send('state', {
                mode: 'upload-error',
                message: error.message,
                name: _basename(path)
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
})
