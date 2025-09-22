import { join } from 'path'
import { type ElementProxy } from 'ymlr/src/components/element-proxy'
import { sleep } from 'ymlr/src/libs/time'
import { Testing } from 'ymlr/src/testing'
import { Mqtt } from './mqtt'
import { MqttPub } from './mqtt-pub'

beforeEach(async () => {
  await Testing.reset()
  Testing.rootScene.tagsManager.register('ymlr-mqtt', join(__dirname, 'index'))
})

test('publish a message', async () => {
  const topicName = Math.random().toString()
  const mqtt = await Testing.createElementProxy<Mqtt>(Mqtt, {
    uri: process.env.MQTT_URI
  })
  await mqtt.exec()
  await mqtt.$.sub([topicName], (topic: string, buf: Buffer) => {
    Testing.vars.topic = topic
    Testing.vars.data = buf.toString()
  })
  const pub = await Testing.createElementProxy(MqttPub, {
    uri: process.env.MQTT_URI,
    topic: topicName,
    data: 'hello world'
  })
  await pub.exec()
  await sleep(500)
  await pub.dispose()
  await mqtt.$.stop()
  expect(Testing.vars.topic).toBe(topicName)
  expect(Testing.vars.data).toBe('hello world')
})

test('publish a message - used in ymlr-mqtt', async () => {
  const topicName = Math.random().toString()
  const data = {
    say: 'hello world'
  }
  const mqtt: ElementProxy<Mqtt> = await Testing.createElementProxy<Mqtt>(Mqtt, {
    uri: process.env.MQTT_URI
  }, {
    runs: [
      {
        'ymlr-mqtt\'pub': {
          topics: [topicName],
          data
        }
      }
    ]
  })
  const sub = await Testing.createElementProxy<Mqtt>(Mqtt, {
    uri: process.env.MQTT_URI
  })
  await sub.exec()
  await sub.$.sub([topicName], (topic: string, buf: Buffer) => {
    Testing.vars.topic = topic
    Testing.vars.data = buf.toString()
  })
  await mqtt.exec()
  await sleep(500)
  await sub.$.stop()
  expect(Testing.vars.topic).toBe(topicName)
  expect(Testing.vars.data).toBe(JSON.stringify(data))
  await mqtt.$.stop()
})

test('publish a message - used the global mqtt', async () => {
  const mqtt: ElementProxy<Mqtt> = await Testing.createElementProxy(Mqtt, {
    uri: process.env.MQTT_URI
  })
  await mqtt.exec()

  const topicName = Math.random().toString()
  const data = {
    say: 'hello world'
  }
  const mqttPub = await Testing.createElementProxy<Mqtt>(MqttPub, {
    mqtt,
    topics: [topicName],
    data
  })
  await mqtt.$.sub([topicName], (topic: string, buf: Buffer) => {
    Testing.vars.topic = topic
    Testing.vars.data = buf.toString()
  })
  await mqttPub.exec()
  await mqttPub.dispose()
  await sleep(500)
  await mqtt.$.stop()
  expect(Testing.vars.topic).toBe(topicName)
  expect(Testing.vars.data).toBe(JSON.stringify(data))
})
