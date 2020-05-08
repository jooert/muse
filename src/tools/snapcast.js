import { snapcast, snapGroups } from '../tools/stores';

let snapcastWS;
let groupsLocal

const c = snapGroups.subscribe((value) => { groupsLocal = value })
const s = snapcast.subscribe((value) => { snapcastWS = value });

export function connectSnapcast() {
  return new Promise(function(resolve, reject) {
    if (snapcastWS) {
      resolve(snapcastWS)
    } else {
      snapcastWS = new WebSocket(`ws://${window.location.hostname}:1780/jsonrpc`);

      /* Error Event Handler */
      snapcastWS.onerror = (e) => {
        // need to get both the statusCode and the reason phrase
        console.log('[Snapcast]: error:', e);
        reject(e);
      };

      snapcastWS.onopen = () => {
        console.log('[Snapcast]: Connected')
        let message = {
          jsonrpc: '2.0',
          id: 8,
          method: 'Server.GetStatus',
        }
        snapcastWS.send(JSON.stringify(message));
        resolve(snapcastWS)
      };

      snapcastWS.onmessage = (message) => {
        handleMessage(message);
      };
    }

  });
}

export function handleMessage (message) {
  const data = JSON.parse(message.data)
  console.log('[Snapcast]: ', data)
  if (data.result && data.result.server && data.result.server.groups) {
    const groupsRaw = data.result.server.groups //.map((x) => x.snapGroups.pop())
    snapGroups.update(v => {
      return groupsRaw.map(group => {
        return { 
          id: group.id,
          name: group.name,
          muted: group.muted,
          clients: group.clients.map(client => {
            return {
              id: client.id,
              name: client.host.name,
              volume: client.config.volume.percent,
              connected: client.connected,
              muted: client.config.volume.muted,
            }
          })
        }
      })
    })
  } 
  if (data && data.method) {
    if (data.method === 'Client.OnDisconnect') {
      const id = data.params.client.id
      const filteredClients = clientsLocal.map(x => {
        if (x.id === id) {
          x.connected = false
        }
        return x
      })
      snapGroups.set(filteredClients)
    } else if (data.method === 'Client.OnConnect') {
      const id = data.params.client.id
      const filteredClients = clientsLocal.map(x => {
        if (x.id === id) {
          x.connected = true
        }
        return x
      })
      snapGroups.set(filteredClients)
    }
  }
}

export function muteClient(clientId, muted) {
  console.log(`Muted ${clientId} - ${muted}`);
  let message = {
    id:8,
    jsonrpc:"2.0",
    method:"Client.SetVolume",
    params:{
      id: clientId,
      volume: {
        muted: false,
        percent: muted ? 10 : 0
      }
    }
  }
  snapcastWS.send(JSON.stringify(message));
  snapGroups.update(v => {
    return groupsLocal.map(group => {
      group.clients.forEach(client => {
        if (client.id == clientId) client.muted = !muted
      })
      return group
    });
  })
}

export function muteGroup(groupId, muted) {
  console.log(groupsLocal);
  console.log(`Muted ${groupId} - ${muted}`);
  let message = {
    id:8,
    jsonrpc:"2.0",
    method:"Group.SetMute",
    params:{
      id: groupId,
      mute: !muted
    }
  }
  snapcastWS.send(JSON.stringify(message));
  snapGroups.update(v => {
    return groupsLocal.map(group => {
      group.muted = !muted
      //if (group.id === groupId) {
      //  group.clients.forEach(client => client.muted = !muted)
      //}
      return group
    });
  })
}

export function changeHandler(id, volume) {
  console.log(`client ${id} - vol ${volume}`);
  let message = {
    id:8,
    jsonrpc:"2.0",
    method:"Client.SetVolume",
    params:{
      id,
      volume:{
        muted:false,
        percent:volume
      }
    }
  }
  snapcastWS.send(JSON.stringify(message));
}
