import { ip, ipv6, mac } from 'address';

/**
 * 获取本机 IPv4 地址
 * @returns {string} IPv4 地址
 */
export function getIp() {
  return ip();
}

/**
 * 获取本机 IPv6 地址
 * @returns {string} IPv6 地址
 */
export function getIpv6() {
  return ipv6();
}

/**
 * 异步获取本机 MAC 地址
 * @returns {Promise<string>} MAC 地址
 */
export function getMac() {
  return new Promise((resolve, reject) => {
    mac((err, addr) => {
      if (err) {
        reject(err);
      } else {
        resolve(addr);
      }
    });
  });
}

/**
 * 异步获取本机全部网络地址信息
 * @returns {Promise<{ip: string, ipv6: string, mac: string}>} 包含 ip、ipv6、mac 的对象
 */
export async function getAllAddresses() {
  const ipAddr = getIp();
  const ipv6Addr = getIpv6();
  let macAddr;
  try {
    macAddr = await getMac();
  } catch (err) {
    macAddr = String(err);
  }
  return { ip: ipAddr, ipv6: ipv6Addr, mac: macAddr };
}
