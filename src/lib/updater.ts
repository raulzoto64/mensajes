const CURRENT_VERSION = __APP_VERSION__
const REPO = 'raulzoto64/mensajes'

type UpdateInfo = {
  needsUpdate: boolean
  version: string
  downloadUrl: string
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) return { needsUpdate: false, version: CURRENT_VERSION, downloadUrl: '' }
    const data = await res.json()
    const remoteVersion = (data.tag_name ?? '').replace(/^v/, '')
    if (!remoteVersion) return { needsUpdate: false, version: CURRENT_VERSION, downloadUrl: '' }
    const needsUpdate = remoteVersion !== CURRENT_VERSION
    const apk = (data.assets ?? []).find((a: any) => a.name?.endsWith('.apk'))
    return {
      needsUpdate,
      version: remoteVersion,
      downloadUrl: apk?.browser_download_url ?? data.html_url ?? '',
    }
  } catch {
    return { needsUpdate: false, version: CURRENT_VERSION, downloadUrl: '' }
  }
}
