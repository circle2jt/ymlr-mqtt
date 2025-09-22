# ymlr-mqtt
ymlr-mqtt for ymlr plugin


<br/>

# Tag details

| Tags | Description |
|---|---|
| [ymlr-mqtt](#ymlr-mqtt) | Declare a mqtt connector |
| [ymlr-mqtt'pub](#ymlr-mqtt'pub) | Publish a message to topics in mqtt |
| [ymlr-mqtt'sub](#ymlr-mqtt'sub) | Subscribe topics in mqtt |



## <a id="ymlr-mqtt"></a>ymlr-mqtt  
  
Declare a mqtt connector  

Example:  

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


## <a id="ymlr-mqtt'pub"></a>ymlr-mqtt'pub  
  
Publish a message to topics in mqtt  

Example:  

Publish a message to mqtt
```yaml
  - name: "[mqtt] localhost"
    ymlr-mqtt'pub:
      uri: mqtt://user:pass@mqtt
      topic: topic1
      topics:
        - topic2
        - topic3
      pubOpts:
        qos?: 0 | 1 | 2
      data:
        name: thanh
```

Reuse mqtt connection to publish multiple times
```yaml
  - name: "[mqtt] localhost"
    ymlr-mqtt:
      uri: mqtt://user:pass@mqtt
      runs:
        - ymlr-mqtt'pub:
            topics:
              - topic1
            pubOpts:
              qos?: 0 | 1 | 2
            data:
              name: thanh
        - ...
        # Other elements
```

Or reuse by global variable
Reuse mqtt connection to publish multiple times
```yaml
  - name: "[mqtt] localhost"
    ymlr-mqtt:
      uri: mqtt://user:pass@mqtt
    vars:
      mqtt1: ${this}

  - ymlr-mqtt'pub:
      mqtt: ${ $vars.mqtt1 }
      topics:
        - topic1
      pubOpts:
        qos?: 0 | 1 | 2
      data:
        name: thanh
```  


## <a id="ymlr-mqtt'sub"></a>ymlr-mqtt'sub  
  
Subscribe topics in mqtt  

Example:  

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


<br/>

### Have fun :)