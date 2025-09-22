import assert from 'assert'
import { type IClientOptions, type IClientSubscribeOptions } from 'mqtt'
import { type ElementProxy } from 'ymlr/src/components/element-proxy'
import { type Element } from 'ymlr/src/components/element.interface'
import { type Group } from 'ymlr/src/components/group/group'
import { type GroupItemProps, type GroupProps } from 'ymlr/src/components/group/group.props'
import { Mqtt } from './mqtt'
import { type MqttSubProps } from './mqtt-sub.props'

/** |**  ymlr-mqtt'sub
  Subscribe topics in mqtt
  @example
  ```yaml
    - name: "[mqtt] localhost"
      ymlr-mqtt'sub:
        uri: mqtt://user:pass@mqtt
        topic: topic1
        topics:                               # topics which is subscribed
          - topic1
          - topic2
      runs:                                 # When a message is received then it will runs them
        - ${ $parentState }                 # - Received data in a topic
        - ${ $ps.topicName }       # - Topic name
        - ${ $ps.topicData }       # - Received message which is cast to object
        - ${ $ps.topicMsg }        # - Received message which is text

        - ...
        # Other elements
  ```

  Used in global mqtt
  ```yaml
    - name: Global MQTT
      ymlr-mqtt:
        uri: mqtt://user:pass@mqtt
      runs:
        - name: "[mqtt] localhost"
          ymlr-mqtt'sub:
            topic: topic1
            topics:                             # topics which is subscribed
              - topic1
              - topic2
          runs:                               # When a message is received then it will runs them
            - ${ $parentState }               # - Received data in a topic
            - ${ $ps.topicName }     # - Topic name
            - ${ $ps.topicData }     # - Received message which is cast to object
            - ${ $ps.topicMsg }      # - Received message which is text

            - ...
            # Other elements
  ```

  Or reuse by global variable
  ```yaml
    - name: Global MQTT
      ymlr-mqtt:
        uri: mqtt://user:pass@mqtt
      vars:
        mqtt1: ${this}

    - name: "[mqtt] localhost"
      ymlr-mqtt'sub:
        mqtt: ${ $vars.mqtt1 }
        topic: topic1
        topics:                             # topics which is subscribed
          - topic1
          - topic2
      runs:                               # When a message is received then it will runs them
        - ${ $parentState }               # - Received data in a topic
        - ${ $ps.topicName }     # - Topic name
        - ${ $ps.topicData }     # - Received message which is cast to object
        - ${ $ps.topicMsg }      # - Received message which is text

        - ...
        # Other elements
  ```
*/
export class MqttSub implements Element {
  readonly ignoreEvalProps = ['t', '_resolve', '_cbIDs']
  readonly proxy!: ElementProxy<this>
  readonly innerRunsProxy!: ElementProxy<Group<GroupProps, GroupItemProps>>

  static SubNames = new Map<string, MqttSub>()

  uri?: string
  opts?: IClientOptions
  subOpts?: IClientSubscribeOptions
  topics: string[] = []
  mqtt?: ElementProxy<Mqtt>
  name?: string
  singleton?: boolean

  private _resolve: any
  private readonly _cbIDs = [] as string[]
  private t?: Promise<any>

  constructor({ uri, opts, topics = [], singleton, topic, name, mqtt }: MqttSubProps) {
    topic && topics.push(topic)
    Object.assign(this, { uri, opts, topics, mqtt, name, singleton })
  }

  tryToParseData(msg: string) {
    try {
      return JSON.parse(msg)
    } catch {
      return msg
    }
  }

  async exec(parentState?: any) {
    let handler = this as MqttSub
    if (this.name) {
      const existed = MqttSub.SubNames.get(this.name)
      if (!existed) {
        MqttSub.SubNames.set(this.name, this)
      } else {
        handler = existed
      }
    }

    if (!this.mqtt) {
      if (this.uri) {
        this.mqtt = await this.proxy.scene.newElementProxy(Mqtt, {
          uri: this.uri,
          opts: this.opts
        })
        this.mqtt.logger = this.proxy.logger
        await this.mqtt.exec()
      } else {
        this.mqtt = this.proxy.getParentByClassName<Mqtt>(Mqtt)
      }
    }

    await handler.start(parentState)

    return []
  }

  async start(parentState: any) {
    if (this.t) return false

    assert(this.mqtt, '"uri" is required OR "ymlr-mqtt\'pub" only be used in "ymlr-mqtt"')

    const ntopics = this.topics.filter(topic => !topic.includes('*'))
    assert(ntopics?.length, 'topic is required')

    if (this.innerRunsProxy?.runs?.length) {
      if (ntopics.length) {
        let isRunning: boolean
        const _cbIDs = await this.mqtt.$.sub(ntopics, async (topic: string | Buffer, message: Buffer | string) => {
          if (this.singleton) {
            if (isRunning) return
            isRunning = true
          }
          try {
            await this.innerRunsProxy.exec({
              ...parentState,
              topicName: topic,
              topicMsg: message.toString(),
              topicData: this.tryToParseData(message.toString())
            })
          } finally {
            if (this.singleton) {
              isRunning = false
            }
          }
        })
        this._cbIDs.push(..._cbIDs)
      }
      this.t = new Promise((resolve) => {
        this._resolve = resolve
      })
      await this.t
    } else {
      if (ntopics.length) {
        await this.mqtt.$.subscribe(ntopics)
      }
    }
    return true
  }

  async stop() {
    if (!this.t) return false

    await this.mqtt?.$.removeCb(this._cbIDs)
    if (this.uri) {
      await this.mqtt?.$.stop()
    }
    if (this.name) {
      MqttSub.SubNames.delete(this.name)
    }
    this.mqtt = undefined
    this._resolve?.()
    await this.t
    this.t = undefined
    return true
  }

  async dispose() {
    await this.stop()
  }
}
