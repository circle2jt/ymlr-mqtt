import { type IClientOptions, type IClientSubscribeOptions } from 'mqtt'
import { type ElementProxy } from 'ymlr/src/components/element-proxy'
import { type Mqtt } from './mqtt'

export interface MqttSubProps {
  name?: string
  mqtt?: ElementProxy<Mqtt>
  uri?: string
  opts?: IClientOptions
  subOpts?: IClientSubscribeOptions
  singleton?: boolean
  topics?: string[]
  topic?: string
}
