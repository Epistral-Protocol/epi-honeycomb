const config = require('./config');
const { plasma, VERSION } = require('./index');

//tell the hive your state, this is asynchronous with IPFS return... 
function report(plas, con) {
    return new Promise((resolve, reject) => {
        con.then(r =>{
            let report = {
                hash: plas.hashLastIBlock,
                block: plas.hashBlock,
                stash: plas.privHash,
                ipfs_id: plas.id,
                version: VERSION
            }
            if(plas.hashBlock % 10000 == 1){
                report.hive_offset = plas.hive_offset,
                report.hbd_offset = plas.hbd_offset
            }
        try {if(r.block > report.block){
                report.sig = r.sig,
                report.sig_block = r.block
            }
        } catch (e){}
        try {if(plasma.oracle){
                report.oracle = plasma.oracle
            }
        } catch (e){}

        var op = [
          "custom_json",
          {
            required_auths: [config.username],
            required_posting_auths: [],
            id: `${config.prefix}report${config.mirrorNet ? "M" : ""}`,
            json: JSON.stringify(report),
          },
        ];
        delete plasma.oracle
        resolve([
            [0, 0], op
        ])
        })
    })
}
exports.report = report;

function sig_submit(sign) {
    return new Promise((resolve, reject) => {
        sign.then(r =>{
            let report = {
                sig: r.sig,
                sig_block: r.block
            }
        var op = [
          "custom_json",
          {
            required_auths: [config.username],
            required_posting_auths: [],
            id: `${config.prefix}sig_submit${config.mirrorNet ? "M" : ""}`,
            json: JSON.stringify(report),
          },
        ];
        resolve([
            [0, 0], op
        ])
        })
    })
}
exports.sig_submit = sig_submit;

function osig_submit(sign) {
    return new Promise((resolve, reject) => {
        sign.then(r =>{
            let report = {
                sig: r.sig,
                sig_block: r.block
            }
        var op = [
          "custom_json",
          {
            required_auths: [config.username],
            required_posting_auths: [],
            id: `${config.prefix}osig_submit${config.mirrorNet ? "M" : ""}`,
            json: JSON.stringify(report),
          },
        ];
        resolve([
            [0, 0], op
        ])
        })
    })
}
exports.osig_submit = osig_submit;