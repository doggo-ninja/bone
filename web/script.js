const { ipcRenderer, clipboard } = require('electron')
const pathLib = require('path')

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0b'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = [
        'b',
        'kb',
        'mb',
        'gb',
        'tb',
        'pb',
        'eb',
        'zb',
        'yb'
    ]

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return (
        parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) +
        +' ' +
        sizes[i]
    )
}

const escape = (unsafe) => unsafe.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const send = (channel, message) => ipcRenderer.send(channel, JSON.stringify(message))

let html
let state = {}

const getHtml = () => {
    if (!state.mode) return ''

    if (state.mode === 'unconfigured') return `
    <h2 class='mb-lg'>setup bone</h2>

    <form id='setup-form'>
        <input type='text' placeholder='token' id='token-input' class='mb-sm' value='${escape(state.token)}'>
        <input type='text' placeholder='folder to watch' id='folder-input' value='${escape(state.watchFolder)}' class='mb-lg'>

        <button type='submit' id='setup-submit' class='main' disabled>
            get started
        </button>
    </form>
    `

    if (state.mode === 'idle') return `
    <h2 class='mb-lg'>drop a file or click <span id='here'>here</span></h2>

    <div class='button-group'>
        <button id='logout'>log out</button>
        <button id='quit'>quit</button>
    </div>
    `

    if (state.mode === 'uploading') return `
    <h2 class='mb-lg'>
        uploading...
        ${escape(Math.round(state.progress.percentage))}%
    </h2>

    <p>
        ${escape(state.name)}
        (${escape(formatBytes(state.progress.length))})
    </p>
    `
state.mode === 'idle'
    if (state.mode === 'upload-error') return `
    <h2 class='mb-lg'>error uploading!</h2>

    <p>there was an issue uploading your file:</p>
    <p class='mb-lg'><strong>${escape(state.message.toLowerCase())}</strong></p>

    <button class='main' id='go-back'>
        go back
    </button>
    `

    if (state.mode === 'uploaded') return `
    <h2 class='mb-lg'>upload completed</h2>

    <p class='mb-lg'>
        your file has been uploaded to doggo.ninja with the shortname ${escape(state.shortName)}
    </p>

    <div class='button-group'>
        <button class='main' id='copy-link'>
            ${[
                'copy link',
                'copied',
                'copied again',
                'much copy',
                'many copy',
                'too copy',
                'ultra copy',
                'reeet copy',
                'stop copying',
                'too much',
                'no no no',
                'i feel pain',
                'aaaaaaaa',
                'aaaaaaa',
                'aaaaaa',
                'aaaaa',
                'aaaa',
                'aaa'
            ][state.copyTimes || 0] || 'X.X'}
        </button>

        <button id='go-back'>
            upload another
        </button>
    </div>
    `
}

const render = (newState) => {
    if (newState === state) return
    state = newState
    ipcRenderer.send('state', JSON.stringify(state))

    const newHtml = getHtml()
    if (newHtml !== html) {
        html = newHtml
        document.getElementById('app').innerHTML = html
        updateListeners()
    }
}

const updateListeners = () => {
    if (state.mode === 'unconfigured') {
        document.getElementById('setup-form').addEventListener('submit', (event) => {
            event.preventDefault()

            send('configure', {
                token: document.getElementById('token-input').value,
                watchFolder: document.getElementById('folder-input').value
            })
        })

        const updateDisabled = () => {
            document.getElementById('setup-submit').disabled = document.getElementById('token-input').value.length === 0
                || document.getElementById('folder-input').value.length === 0
        }

        document.getElementById('token-input').addEventListener('input', updateDisabled)
        document.getElementById('folder-input').addEventListener('input', updateDisabled)
        updateDisabled()
    }

    if (state.mode === 'idle') {
        document.getElementById('logout').addEventListener('click', () => send('logout'))
        document.getElementById('quit').addEventListener('click', () => send('quit'))
        document.getElementById('here').addEventListener('click', () => send('app-upload'))
    }

    if (state.mode === 'upload-error' || state.mode === 'uploaded') {
        document.getElementById('go-back').addEventListener('click', () => render({
            mode: 'idle'
        }))
    }

    if (state.mode === 'uploaded') {
        document.getElementById('copy-link').addEventListener('click', () => {
            clipboard.write({
                text: state.url,
                html: `<a href='${state.url}'>${state.url}</a>`,
                bookmark: state.name
            })

            render({
                ...state,
                copyTimes: (state.copyTimes || 0) + 1
            })
        })
    }
}

ipcRenderer.on('state', (_, newState) => {
    render(newState)
})

document.ondragover = (event) => {
    event.preventDefault()
    if (state.mode === 'idle') event.dataTransfer.dropEffect = 'copy'
}

document.ondrop = (event) => {
    event.preventDefault()
    if (state.mode !== 'idle') return
    if (!event.dataTransfer.files[0]) return

    send('drop', { path: event.dataTransfer.files[0].path })
    firebase.analytics().logEvent('file_upload', {
        file_extension: pathLib.extname(event.dataTransfer.files[0].path).slice(1).toLowerCase(),
        method: 'drop_on_document'
    })
}

send('ready')