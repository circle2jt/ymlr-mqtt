import assert from 'assert'
import { connect, type IClientOptions, type IClientPublishOptions, type IClientSubscribeOptions, type IPublishPacket, type ISubscriptionGrant, type MqttClient, type Packet } from 'mqtt'
import { type ElementProxy } from 'ymlr/src/components/element-proxy'
import { type Element } from 'ymlr/src/components/element.interface'
import { type Group } from 'ymlr/src/components/group/group'
import { type GroupItemProps, type GroupProps } from 'ymlr/src/components/group/group.props'
import { type MqttProps } from './mqtt.props'

export type OnMessageBufferCallback = (topic: string, payload: Buffer, packet: IPublishPacket) => any
/** |**  ymlr-mqtt
  Declare a mqtt connector
  @example
  ```yaml
    - name: "[mqtt] localhost"
      ymlr-mqtt:
        uri: mqtt://user:pass@mqtt            # Mqtt uri
      runs:                                 # When a message is received then it will runs them
        - echo: Mqtt is connected
  ```
  Publish a message to topics
  ```yaml
    - name: "[mqtt] localhost"
      ymlr-mqtt:
        uri: mqtt://user:pass@mqtt            # Mqtt uri
      runs:                                 # When a message is received then it will runs them
        - name: Publish a message
          ymlr-mqtt'pub:
            topics:
              - test
            data:
              msg: Hello world
  ```
*/
export class Mqtt implements Element {
  readonly proxy!: ElementProxy<this>
  readonly innerRunsProxy!: ElementProxy<Group<GroupProps, GroupItemProps>>
  readonly ignoreEvalProps = ['callbacks', 'resolve', 'promSubscribe']
  uri!: string
  opts?: IClientOptions

  callbacks?: {
    id: Map<string, OnMessageBufferCallback>
    buffer?: Map<string, Set<OnMessageBufferCallback>>
  }

  private resolve?: (_: any) => void
  private promSubscribe?: Promise<any>
  client!: MqttClient

  get logger() {
    return this.proxy.logger
  }

  constructor(private readonly props: MqttProps) {
    Object.assign(this, props)
  }

  async newOne() {
    const newOne = await (this.proxy.parent as Group<any, any>).newElementProxy<Mqtt>(Mqtt, this.props)
    await newOne.exec()
    return newOne
  }

  async waitToDone() {
    if (!this.promSubscribe) return
    return await this.promSubscribe
  }

  async pub(topics: string[] | string, data?: any, pubOpts?: IClientPublishOptions) {
    if (!Array.isArray(topics)) topics = [topics]
    if (!topics?.length) return
    let msg = data ?? ''
    if (typeof msg === 'object' && !(msg instanceof Buffer)) {
      msg = JSON.stringify(msg)
    }
    this.logger.debug('⇢ [%s]\t%j', topics.join('|'), msg.toString())
    const proms = topics.map(async topic => await new Promise((resolve, reject) => {
      if (!pubOpts) {
        this.client.publish(topic, msg.toString(), (err?: Error, packet?: Packet) => {
          if (err) { reject(err); return }
          resolve(packet)
        })
      } else {
        this.client.publish(topic, msg.toString(), pubOpts, (err?: Error, packet?: Packet) => {
          if (err) { reject(err); return }
          resolve(packet)
        })
      }
    }))
    if (proms?.length) {
      await Promise.all(proms)
    }
  }

  async subscribe(topics: string[], subOpts?: IClientSubscribeOptions) {
    if (!subOpts) {
      await new Promise((resolve, reject) => {
        this.client.subscribe(topics, (err: Error, granted: ISubscriptionGrant[]) => {
          if (err) { reject(err); return }
          resolve(granted)
        })
      })
    } else {
      await new Promise((resolve, reject) => {
        this.client.subscribe(topics, subOpts, (err: Error, granted: ISubscriptionGrant[]) => {
          if (err) { reject(err); return }
          resolve(granted)
        })
      })
    }
  }

  async unsubscribe(topics: string[]) {
    await new Promise((resolve, reject) => {
      this.client.unsubscribe(topics, (err: Error, packet: Packet[]) => {
        if (err) { reject(err); return }
        resolve(packet)
      })
    })
  }

  private async _sub(topics: string[] | string, cb: OnMessageBufferCallback | undefined, subOpts?: IClientSubscribeOptions) {
    let callbackType = 1
    const callbackIDs = [] as string[]
    if (!Array.isArray(topics)) {
      topics = [topics]
      callbackType = 0
    }
    if (topics?.length) {
      this.logger.debug(`Subscribed "${topics}" in "${this.uri}"`)
      if (topics.length) {
        await this.subscribe(topics, subOpts)
      }
      if (cb) {
        if (!this.callbacks) {
          this.callbacks = {
            id: new Map(),
            buffer: undefined
          }
        }
        if (!this.callbacks?.buffer) {
          this.callbacks.buffer = new Map()
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          this.client.on('message', this.onMessageBuffer.bind(this))
        }
        const cbTopics = this.callbacks.buffer as Map<string, Set<any>>
        assert(cbTopics, 'Topic type is not correct')
        const id: Map<string, any> = this.callbacks.id
        const rd = Math.random().toString()
        topics.forEach((topic, i) => {
          if (!cbTopics.has(topic)) cbTopics.set(topic, new Set())

          const callbackID = `buffer:${topic}:${i}:${rd}`
          id.set(callbackID, cb)
          cbTopics.get(topic)?.add(id.get(callbackID))
          callbackIDs.push(callbackID)
        })

        if (!this.promSubscribe) {
          this.promSubscribe = new Promise(resolve => {
            this.resolve = resolve
          })
        }
      }
    }
    return callbackType === 1 ? callbackIDs : callbackIDs[0]
  }

  async sub(topic: string, cb: OnMessageBufferCallback | undefined,): Promise<string>
  async sub(topics: string[], cb: OnMessageBufferCallback | undefined): Promise<string[]>
  async sub(topics: string[] | string, cb: OnMessageBufferCallback | undefined) {
    return await this._sub(topics, cb)
  }

  async unsub(topics: string[] | string, isRemoveCallback = true) {
    if (typeof topics === 'string') {
      topics = [topics]
    }
    if (!topics.length) return
    this.logger.debug(`Subscribed "${topics}" in "${this.uri}"`)
    await this.unsubscribe(topics)
    if (isRemoveCallback) {
      topics.forEach(topic => {
        Object.keys(this.callbacks?.id || {})
          .filter(uuid => uuid.includes(`:${topic}:`))
          .forEach(uuid => this.callbacks?.id.delete(uuid))
        this.callbacks?.buffer?.delete(topic)
        this.callbacks?.buffer?.delete(topic)
      })
    }
  }

  async removeCb(uuids: string | string[]) {
    if (!Array.isArray(uuids)) {
      uuids = [uuids]
    }
    [...(this.callbacks?.id.keys() || [])]
      .filter((uuid: string) => uuids.includes(uuid))
      .forEach((uuid: string) => {
        const [type, topic] = uuid.split(':')
        const cb = this.callbacks?.id.get(uuid)
        if (cb) {
          // @ts-expect-error system generate is always passed
          const ch = this.callbacks?.[type]?.get(topic)
          ch?.delete(cb)
        }
        this.callbacks?.id.delete(uuid)
      })
  }

  async exec(parentState?: any) {
    assert(this.uri, '"uri" is required')
    this.client = connect(this.uri || '', this.opts)
    await new Promise((resolve, reject) => {
      this.client.on('connect', resolve).on('error', reject)
    })
    const rs = await this.innerRunsProxy.exec({
      ...parentState,
      mqtt: this.client
    })
    return rs
  }

  async stop() {
    await new Promise((resolve, reject) => {
      this.client.end(true, (err?: Error) => {
        if (err) { reject(err); return }
        resolve(undefined)
      })
    })
    if (this.resolve) this.resolve(undefined)
  }

  async dispose() {
    await this.stop()
  }

  private async onMessageBuffer(topic: string, message: Buffer, iPublishPacket: IPublishPacket) {
    if (!this.callbacks) return
    const callbacks = this.callbacks.buffer?.get(topic.toString()) as Set<OnMessageBufferCallback>
    if (!callbacks?.size) return
    this.logger.debug('⇠ [%s]\t%s', topic, message)
    await Promise.all([...callbacks].map(cb => cb(topic, message, iPublishPacket)))
  }
}
