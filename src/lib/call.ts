import { supabase } from './supabase'

export type CallStatus = 'idle' | 'calling' | 'connecting' | 'active' | 'ended'
export type PeerState = 'new' | 'connecting' | 'connected' | 'failed'

export interface Participant {
  userId: string
  alias: string
}

export interface PeerInfo {
  userId: string
  alias: string
  state: PeerState
  stream: MediaStream | null
}

export interface IncomingCall {
  callId: string
  initiatorId: string
  initiatorAlias: string
  kind: 'audio'
  participants: Participant[]
}

export interface CallState {
  status: CallStatus
  callId: string | null
  kind: 'audio'
  initiatorId: string | null
  participants: Participant[]
  peers: Record<string, PeerInfo>
  muted: boolean
  error: string | null
  incoming: IncomingCall | null
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

type Listener = (s: CallState) => void

class CallManager {
  private state: CallState = {
    status: 'idle',
    callId: null,
    kind: 'audio',
    initiatorId: null,
    participants: [],
    peers: {},
    muted: false,
    error: null,
    incoming: null,
  }
  private listeners = new Set<Listener>()
  private me: Participant | null = null
  private localStream: MediaStream | null = null
  private pcs = new Map<string, RTCPeerConnection>()
  private pendingIce = new Map<string, RTCIceCandidateInit[]>()
  private callChannel: ReturnType<typeof supabase.channel> | null = null
  private inviteChannel: ReturnType<typeof supabase.channel> | null = null

  init(userId: string, alias: string) {
    this.me = { userId, alias }
    this.subscribeInvites()
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    l(this.state)
    return () => this.listeners.delete(l)
  }

  getState() {
    return this.state
  }

  private emit() {
    const snap = JSON.parse(JSON.stringify(this.state)) as CallState
    this.listeners.forEach((l) => l(snap))
  }

  private subscribeInvites() {
    if (!this.me || this.inviteChannel) return
    this.inviteChannel = supabase
      .channel(`calls:${this.me.userId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'invite' }, ({ payload }: any) => {
        if (this.state.status !== 'idle') return
        this.state = { ...this.state, incoming: payload as IncomingCall }
        this.emit()
      })
      .subscribe()
  }

  async startCall(callId: string, participants: Participant[]) {
    if (!this.me) return
    this.state = {
      ...this.state,
      status: 'calling',
      callId,
      kind: 'audio',
      initiatorId: this.me.userId,
      participants,
      peers: {},
      muted: false,
      error: null,
      incoming: null,
    }
    this.emit()
    await this.ensureLocalStream()
    if (this.state.error) return
    this.joinCallChannel(callId)
    for (const p of participants) {
      if (p.userId === this.me.userId) continue
      const ch = supabase.channel(`calls:${p.userId}`, { config: { broadcast: { self: false } } })
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'invite',
            payload: {
              callId,
              initiatorId: this.me!.userId,
              initiatorAlias: this.me!.alias,
              kind: 'audio',
              participants,
            },
          })
        }
      })
      setTimeout(() => supabase.removeChannel(ch), 1500)
    }
    this.broadcastOnCall({
      type: 'broadcast',
      event: 'join',
      payload: { userId: this.me.userId, alias: this.me.alias },
    })
  }

  async acceptCall() {
    const inc = this.state.incoming
    if (!inc || !this.me) return
    this.state = {
      ...this.state,
      status: 'connecting',
      callId: inc.callId,
      kind: 'audio',
      initiatorId: inc.initiatorId,
      participants: inc.participants,
      peers: {},
      muted: false,
      incoming: null,
      error: null,
    }
    this.emit()
    await this.ensureLocalStream()
    if (this.state.error) return
    this.joinCallChannel(inc.callId)
    this.broadcastOnCall({
      type: 'broadcast',
      event: 'join',
      payload: { userId: this.me.userId, alias: this.me.alias },
    })
  }

  rejectCall() {
    this.state = { ...this.state, incoming: null }
    this.emit()
  }

  async hangUp() {
    this.broadcastOnCall({ type: 'broadcast', event: 'leave', payload: { userId: this.me?.userId } })
    this.cleanup()
    this.state = {
      ...this.state,
      status: 'ended',
      callId: null,
      initiatorId: null,
      participants: [],
      peers: {},
      incoming: null,
    }
    this.emit()
    setTimeout(() => {
      if (this.state.status === 'ended') {
        this.state = { ...this.state, status: 'idle' }
        this.emit()
      }
    }, 1500)
  }

  toggleMute() {
    if (!this.localStream) return
    const next = !this.state.muted
    this.localStream.getAudioTracks().forEach((t) => (t.enabled = !next))
    this.state = { ...this.state, muted: next }
    this.emit()
  }

  private async ensureLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (e: any) {
      this.state = {
        ...this.state,
        error: 'No se pudo acceder al micrófono: ' + (e?.message ?? e),
        status: 'idle',
      }
      this.emit()
    }
  }

  private joinCallChannel(callId: string) {
    if (this.callChannel) supabase.removeChannel(this.callChannel)
    this.callChannel = supabase
      .channel(`call:${callId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'join' }, ({ payload }: any) => this.onJoin(payload))
      .on('broadcast', { event: 'offer' }, ({ payload }: any) => this.onOffer(payload))
      .on('broadcast', { event: 'answer' }, ({ payload }: any) => this.onAnswer(payload))
      .on('broadcast', { event: 'ice' }, ({ payload }: any) => this.onIce(payload))
      .on('broadcast', { event: 'leave' }, ({ payload }: any) => this.onLeave(payload))
      .subscribe()
  }

  private broadcastOnCall(msg: any) {
    if (!this.callChannel) return
    this.callChannel.send(msg)
  }

  private aliasOf(userId: string): string {
    return this.state.participants.find((p) => p.userId === userId)?.alias ?? userId.slice(0, 6)
  }

  private async onJoin(payload: { userId: string; alias: string }) {
    if (!this.me || payload.userId === this.me.userId) return
    this.ensurePeer(payload.userId, payload.alias)
    if (this.me.userId < payload.userId) {
      const pc = this.pcs.get(payload.userId)!
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.broadcastOnCall({
        type: 'broadcast',
        event: 'offer',
        payload: { from: this.me.userId, to: payload.userId, sdp: pc.localDescription },
      })
    }
  }

  private async onOffer(payload: { from: string; to: string; sdp: any }) {
    if (!this.me || payload.to !== this.me.userId) return
    this.ensurePeer(payload.from, this.aliasOf(payload.from))
    const pc = this.pcs.get(payload.from)!
    await pc.setRemoteDescription(payload.sdp)
    await this.flushIce(payload.from)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    this.broadcastOnCall({
      type: 'broadcast',
      event: 'answer',
      payload: { from: this.me.userId, to: payload.from, sdp: pc.localDescription },
    })
  }

  private async onAnswer(payload: { from: string; to: string; sdp: any }) {
    if (!this.me || payload.to !== this.me.userId) return
    const pc = this.pcs.get(payload.from)
    if (!pc) return
    await pc.setRemoteDescription(payload.sdp)
    await this.flushIce(payload.from)
  }

  private async onIce(payload: { from: string; to: string; candidate: RTCIceCandidateInit }) {
    if (!this.me || payload.to !== this.me.userId) return
    const pc = this.pcs.get(payload.from)
    if (!pc) return
    if (!pc.remoteDescription || !pc.remoteDescription.type) {
      const q = this.pendingIce.get(payload.from) ?? []
      q.push(payload.candidate)
      this.pendingIce.set(payload.from, q)
      return
    }
    try {
      await pc.addIceCandidate(payload.candidate)
    } catch (e) {
      console.error('[call] addIceCandidate error', e)
    }
  }

  private async flushIce(userId: string) {
    const q = this.pendingIce.get(userId)
    if (!q || !q.length) return
    const pc = this.pcs.get(userId)
    if (!pc) return
    for (const c of q) {
      try {
        await pc.addIceCandidate(c)
      } catch (e) {
        console.error('[call] flushIce error', e)
      }
    }
    this.pendingIce.delete(userId)
  }

  private onLeave(payload: { userId: string }) {
    const pc = this.pcs.get(payload.userId)
    if (pc) {
      pc.close()
      this.pcs.delete(payload.userId)
    }
    const peers = { ...this.state.peers }
    delete peers[payload.userId]
    this.state = { ...this.state, peers }
    this.emit()
  }

  private ensurePeer(userId: string, alias: string) {
    if (this.pcs.has(userId)) return
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.state = {
      ...this.state,
      peers: { ...this.state.peers, [userId]: { userId, alias, state: 'connecting', stream: null } },
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => pc.addTrack(t, this.localStream!))
    }
    pc.onicecandidate = (e) => {
      if (e.candidate && this.me) {
        this.broadcastOnCall({
          type: 'broadcast',
          event: 'ice',
          payload: { from: this.me.userId, to: userId, candidate: e.candidate.toJSON() },
        })
      }
    }
    pc.ontrack = (e) => {
      const stream = e.streams[0]
      const peers = { ...this.state.peers }
      if (peers[userId]) peers[userId] = { ...peers[userId], stream, state: 'connected' }
      this.state = { ...this.state, peers, status: this.state.status === 'calling' ? 'active' : this.state.status }
      this.emit()
    }
    pc.onconnectionstatechange = () => {
      const peers = { ...this.state.peers }
      if (peers[userId]) peers[userId] = { ...peers[userId], state: pc.connectionState as PeerState }
      this.state = { ...this.state, peers }
      this.emit()
    }
    this.pcs.set(userId, pc)
    this.emit()
  }

  private cleanup() {
    this.pcs.forEach((pc) => pc.close())
    this.pcs.clear()
    this.pendingIce.clear()
    if (this.callChannel) {
      supabase.removeChannel(this.callChannel)
      this.callChannel = null
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }
  }
}

export const callManager = new CallManager()
