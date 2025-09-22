import { type ElementProxy } from 'ymlr/src/components/element-proxy'
import { sleep } from 'ymlr/src/libs/time'
import { Testing } from 'ymlr/src/testing'
import { Mqtt } from './mqtt'

let mqtt: ElementProxy<Mqtt>

beforeEach(async () => {
  await Testing.reset()
})

afterEach(async () => {
  await mqtt.$.stop()
})

test.only('test mqtt', async () => {
  const topicName = Math.random().toString()
  mqtt = await Testing.createElementProxy(Mqtt, {
    uri: process.env.MQTT_URI,
    topics: [topicName]
  }, {
    runs: [{
      echo: 'hello'
    }]
  })
  const [echo] = await mqtt.exec()
  expect(mqtt.$.client).toBeDefined()
  expect(echo.result).toBe('hello')
})

test('subscribe', async () => {
  const topicName = Math.random().toString()
  mqtt = await Testing.createElementProxy(Mqtt, {
    uri: process.env.MQTT_URI,
    topics: [topicName]
  }, {
    runs: [{
      echo: 'hello'
    }]
  })
  await mqtt.exec()
  await mqtt.$.sub(['topic-0'], () => {
    topicCount[0]++
  })
  await mqtt.$.sub(['topic-1'], () => {
    topicCount[1]++
  })
  const topicCount = [0, 0]
  await mqtt.$.pub(['topic-0'], undefined)
  await mqtt.$.pub(['topic-1'], undefined)
  await mqtt.$.pub(['topic-1'], undefined)
  await sleep(500)
  expect(topicCount[0]).toBe(1)
  expect(topicCount[1]).toBe(2)
})

test('sub waitToDone', async () => {
  const topicName = Math.random().toString()
  mqtt = await Testing.createElementProxy(Mqtt, {
    uri: process.env.MQTT_URI,
    topics: [topicName]
  })
  await mqtt.exec()
  const begin = Date.now()
  await mqtt.$.sub('c1', () => { })
  await Promise.race([
    mqtt.$.waitToDone(),
    sleep(1000)
  ])
  expect(Date.now() - begin).toBeGreaterThanOrEqual(1000)
})

test('sub callback', async () => {
  const topicName = Math.random().toString()
  mqtt = await Testing.createElementProxy(Mqtt, {
    uri: process.env.MQTT_URI,
    topics: [topicName]
  }, {
    runs: [{
      echo: 'hello'
    }]
  })
  await mqtt.exec()
  const subMqtt1 = await mqtt.$.newOne()
  try {
    let c1 = 0
    let c2 = 0
    const [id1, id2] = await Promise.all([
      subMqtt1.$.sub('c1', () => {
        c1++
      }),
      subMqtt1.$.sub('c2', () => {
        c2++
      })
    ])

    await mqtt.$.pub('c1')
    await mqtt.$.pub('c2')
    await sleep(200)
    expect(c1).toBe(1)
    expect(c2).toBe(1)

    const callbacks = subMqtt1.$.callbacks as any

    expect(callbacks.id.size).toBe(2)
    expect(callbacks.id.get(id2)).toBeDefined()
    expect(callbacks.id.get(id1)).toBeDefined()
    expect(callbacks.buffer.size).toBe(2)
    expect(callbacks.buffer.get('c1').size).toBe(1)
    expect(callbacks.buffer.get('c2').size).toBe(1)

    await subMqtt1.$.removeCb(id2)
    expect(callbacks.id.size).toBe(1)
    expect(callbacks.id.get(id2)).toBeUndefined()
    expect(callbacks.id.get(id1)).toBeDefined()
    expect(callbacks.buffer.size).toBe(2)
    expect(callbacks.buffer.get('c1').size).toBe(1)
    expect(callbacks.buffer.get('c2').size).toBe(0)

    await mqtt.$.pub('c1')
    await mqtt.$.pub('c2')
    await sleep(200)
    expect(c1).toBe(2)
    expect(c2).toBe(1)
    await subMqtt1.$.removeCb(id1)

    expect(callbacks.id.size).toBe(0)
    expect(callbacks.id.get(id2)).toBeUndefined()
    expect(callbacks.id.get(id1)).toBeUndefined()
    expect(callbacks.buffer.size).toBe(2)
    expect(callbacks.buffer.get('c1').size).toBe(0)
    expect(callbacks.buffer.get('c2').size).toBe(0)
  } finally {
    await subMqtt1.$.stop()
  }
})
