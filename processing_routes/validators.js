const config = require("./../config");
const { store } = require("./../index");
const { getPathObj, getPathNum, deleteObjs } = require("./../getPathObj");
const { isEmpty } = require("./../lil_ops");
const { postToDiscord } = require("./../discord");
const { decode, encode } = require("@hiveio/hive-js").memo;
const { Base58 } = require("./../helpers");
const { chronAssign } = require("./../lil_ops");

exports.val_reg = function (json, from, active, pc) {
  var mskey, brandOK = false
  if (json.mskey && json.mschallenge) {
    try {
      const verifyKey = decode(config.msPriMemo, json.mschallenge);
      const nowhammies = encode(config.msPriMemo, config.msPubMemo, verifyKey);
      const isValid = encode(config.msPriMemo, json.mskey, "#try");
      if (
        typeof isValid == "string" &&
        verifyKey == `#${json.mskey}` &&
        nowhammies != json.mschallenge
      )
        mskey = json.mskey;
    } catch (e) {}
  }
  if(typeof json.brand == 'number')brandOK = true
  if (brandOK && mskey && json.domain && typeof json.domain === "string") {
    //store.get(["markets", "v", from], function (e, a) {
    let Pvnode = getPathObj(["markets", "v", from]);
    let Pbal = getPathNum(["balances", from]);
    let Pstats = getPathObj(["stats"]);
    Promise.all([Pvnode, Pbal, Pstats]).then((mem) => {
      let ops = [];
      if (isEmpty(mem[0]) && json.brand >= mem[2].vnode.min && json.brand >= mem[1]) {
        ops.push({ type: "put", path: ["balances", from], data: mem[1] - parseInt(json.brand) });
        data = {
          domain: json.domain || "localhost",
          self: from,
          strikes: 0,
          branded: parseInt(json.brand),
          riding: {},
          contracts: {},
          mskey,
        };
        ops = [
          {
            type: "put",
            path: ["markets", "v", from],
            data,
          },
        ];
        const msg = `@${from}| has branded ${json.brand} into their validator node at ${json.domain}`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      } else {
        ops = [
          {
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: `@${from}| insufficient LARYNX to brand a validator node.`,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }
    });
  } else {
    ops = [
      {
        type: "put",
        path: ["feed", `${json.block_num}:${json.transaction_id}`],
        data: `@${from}| sent and invalid validator add operation`,
      },
    ];
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  }
};



/* explanation:
Validator Nodes are the nodes that are used to validate IPFS and assist in running the network.
To start one an amount of LARYNX needs to be ~burned into the validator node. This is called a brand.
The minimum amount is set by the SPK network governance. Other key items here are: domain, mskey, and mschallenge.
The mschallenge is only a dummy check to ensure a key pair was entered into the config file. It can't prevent a bad key from being carefully inserted.
The mskey is used to send and receive encrypted memos. These memos will help SPK network clients to send and receive other information by building secure channels.
These secure channels can be found at the API provided at the domain.
Riding is powered larynx that earns less than a brand. These might lower fees for the delegators, as the lower reward is split with the validitor.

contracts are expirationBlock:QmHash

The Job:
0. Establish a channel to prevent spam
1. Receive data to be uploaded to IPFS
2. Hold data long enough for IPFS nodes to hold copies / Pin Management
4. Use pseudo-random number to probe IPFS hashes for availability.
5. Ask for IPFS hash from IPFS nodes that should have the data as well as public nodes or other nodes of the network.
6. Verify hash via byte counts and re-add.
7. Report the order in which the correct files are received.
8. Get rewarded in SPK / Broca Tokens along with the IPFS nodes for their efforts.


ToDo:
stats.vnode.min

validators.total
.nodes[node].rl //range low
.nodes[node].rh //range high
.nodes[node].b //brand
.nodes[node].d //delegate
.nodes[node].v //spk votes?

*/

exports.val_add = function (json, from, active, pc) { //add Larynx to brand
  var Pvnode = getPathObj(["markets", "v", from]),
    Pbal = getPathNum(["balances", from]),
    Pstats = getPathObj(["stats"]);
  Promise.all([Pvnode, Pbal, Pstats]).then((mem) => {
    var Error = ''
    if(isEmpty(mem[0]))Error += 'No validator node found. '
    if(mem[1] < parseInt(json.brand))Error += 'Insufficient LARYNX to add to validator node. '
    if(!Error){
      let data = {
        ...mem[0],
      };
      data.branded += parseInt(json.brand);
      data.branded += parseInt(json.brand);
      let ops = [
        {
          type: "put",
          path: ["balances", from],
          data: mem[1] - parseInt(json.brand),
        },
        {
          type: "put",
          path: ["markets", "v", from],
          data,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      ops = [
        {
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: `@${from}| ${Error}`,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    }
  })
}

exports.val_bytes_flag = function (json, from, active, pc) {
  const Pcon = getPathObj(["f", json.file]),
    Psnodes = getPathObj(["markets", "s"]);
  Promise.all([Pcon, Psnodes]).then((mem) => {
    var contract = mem[0],
      snodes = mem[1];
    if(snodes[from].id == contract.a || snodes[from].id == contract.b || snodes[from].id == contract.c){
      if(contract.b != json.bytes){
        contract[snodes[from].id] = json.bytes
        contract.sd = 1 //size dispute
      }
      let ops = [
        {
          type: "put",
          path: ["f", json.file],
          data: contract
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      chronAssign(json.block_num + 500, {
        op: "sd",
        f: json.file
      }).then(empty => {
        store.batch(ops, pc);
      })
    } else {
      pc[0](pc[2]);
    }
  })
}

exports.val_bytes = function (json, from, active, pc) { //update domain or mskey
  const Pcon = getPathObj(["f", json.file])
  Promise.all([Pcon]).then((mem) => {
    var contract = mem[0]
    const rangeCheck = (Base58.toNumber(json.file.substr(14, 20)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
    if (
        rangeCheck >= validators.nodes[from].rl &&
        rangeCheck <= validators.nodes[from].rh
      ) {
      let ops = [
        {
          type: "put",
          path: ["valCheck", `${json.block}:${json.file}`],
          data: check,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      pc[0](pc[2]);
    }
  });
}

exports.val_bundle = function (json, from, active, pc) { //IPFS bundle offered from validator to IPFS storage
  var Pvnode = getPathObj(["markets", "v", from]),
    Psnodes = getPathObj(["markets", "s"])

  Promise.all([Pvnode, Psnodes]).then((mem) => {
    var vnode = mem[0],
      snodes = mem[1],
      ops = [],
      promises = []
    if(from == vnode.self && json.bundle.length){
      var i = 0
      makeStorageContract(i, snodes, json, from, [])
      .then(r=>{
        ops = r
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      })
    } else {
      pc[0](pc[2]);
    }
  });
}

function makeStorageContract(i, snodes, json, from, ops){
  return new Promise((resolve, reject) => {
    var data = {
      s: json.bundle[i].s, //size
      v: from,
    }
    if (snodes[json.bundle[i].a].self == json.bundle[i].a)data.a = snodes[json.bundle[i].a].id
    if (snodes[json.bundle[i].b].self == json.bundle[i].b)data.b = snodes[json.bundle[i].b].id;
    if (snodes[json.bundle[i].c].self == json.bundle[i].c)data.c = snodes[json.bundle[i].c].id;
    chronAssign(json.block_num + 2592000, { //90 days
      op: "rm",
      f: json.bundle[i].f,
    })
    .then(r=>{
      data.x = r
      ops.push({ type: "put", path: ["f", json.bundle[i].f], data })
      if(json.bundles.length > i){
        i++
        makeStorageContract(i, snodes, json, from, ops)
      } else {
        resolve(ops)
      }
    })
  })
}

exports.val_report = function (json, from, active, pc) { //periodic report of ping times of items.
  const Pcon = getPathObj(['f', json.file]),
    Pnonce = getPathObj(['nonce', `${json.block % 1000}`]),
    Pcheck = getPathObj(['valCheck', `${json.block}:${json.file}`]),
    Pvalidators = getPathObj(["validators"])
  var fileCheck = false, nodeCheck = true

  Promise.all([Pcon, Pnonce, Pcheck, Pvalidators]).then((mem) => {
    var contract = mem[0],
      nonce = mem[1],
      check = mem[2],
      validators = mem[3]
    if (
      Base58.toNumber(json.file.substr(2, 6)) ==
      JSON.parseInt(nonce.substr(0, 8), 16) % Math.pow(58, 4)
    )
      fileCheck = true;
    const rangeCheck = (Base58.toNumber(json.file.substr(14, 20)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
      if (
        rangeCheck >= validators.nodes[from].rl &&
        rangeCheck <= validators.nodes[from].rh
      )nodeCheck = true
    if (contract.b && fileCheck && nodeCheck) {
      check.v = {
        z: json.block_num, //block number
        v: from,
      };
      if(json.a > 0 && json.a <= 5)check.a = parseInt(json.a); //ordered pass
      if(json.b > 0 && json.b <= 4)check.b = parseInt(json.b);
      if(json.c > 0 && json.c <= 3)check.c = parseInt(json.c);
      if(json.d > 0 && json.d <= 2)check.d = parseInt(json.d);
      if(json.e > 0 && json.e <= 1)check.e = parseInt(json.e);
      if(json.f > 0 && json.f <= 5)check.f = parseInt(json.f); //failures
      if(json.g > 0 && json.g <= 4)check.g = parseInt(json.g);
      if(json.h > 0 && json.h <= 3)check.h = parseInt(json.h);
      if(json.i > 0 && json.i <= 2)check.i = parseInt(json.i);
      if(json.j > 0 && json.j <= 1)check.j = parseInt(json.j);
      chronAssign(json.block_num + 100, { //5 minutes, reward storage
       op: "rs",
        f: json.file,
        b: json.block
      }).then(r=>{
        let ops = [
          {
            type: "put",
            path: ["valCheck", `${json.block}:${json.file}`],
            data: check,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      })
    } else {
      pc[0](pc[2]);
    }
  });
}



exports.val_check = function (json, from, active, pc) { //second-check of IPFS hash isAvail
  const Pcon = getPathObj(["f", json.file]),
    Pnonce = getPathObj(["nonce", `${json.block % 1000}`]),
    Pvalidators = getPathObj(["validators"]),
    Pcheck = getPathObj(["valCheck", `${json.block}:${json.file}`]);
  var fileCheck = false,
    nodeCheck = 0;

  Promise.all([Pcon, Pnonce, Pvalidators, Pcheck]).then((mem) => {
    var contract = mem[0],
      nonce = mem[1],
      validators = mem[2],
      check = mem[3],
      rangeCheck = (Base58.toNumber(json.file.substr(7, 13)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
    if (
      Base58.toNumber(json.file.substr(2, 6)) ==
      JSON.parseInt(nonce.substr(0, 8), 16) % Math.pow(58, 4)
    )
      fileCheck = true;
    if (
      rangeCheck >= validators.nodes[from].rl &&
      rangeCheck <= validators.nodes[from].rh
    ) {
      nodeCheck = 1;
    } else {
      rangeCheck = (Base58.toNumber(json.file.substr(14, 20)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
      if (
        rangeCheck >= validators.nodes[from].rl &&
        rangeCheck <= validators.nodes[from].rh
      ) {
        nodeCheck = 2;
      } else {
        rangeCheck = ( Base58.toNumber(json.file.substr(21, 27)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
        if (
          rangeCheck >= validators.nodes[from].rl &&
          rangeCheck <= validators.nodes[from].rh
        )
          nodeCheck = 3;
      }
    }
    if (contract.b && fileCheck && nodeCheck) {
      check[nodeCheck] = {
        b: json.block_num, //block number
        a: json.isAvail ? 1 : 0, //availability
        f: from,
      };

      let ops = [
        {
          type: "put",
          path: ["valCheck", `${json.block}:${json.file}`],
          data: check,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      pc[0](pc[2]);
    }
  });
}

//power up
//delegate

//spk transfer
// spk dex?
//spk power up
//spk vote
