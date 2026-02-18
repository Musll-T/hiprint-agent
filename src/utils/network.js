import address from 'address';

/**
 * 获取本机 IPv4 地址
 * @returns {string} IPv4 地址
 */
export function getIp() {
  return address.ip();
}

/**
 * 获取本机 IPv6 地址
 * @returns {string} IPv6 地址
 */
export function getIpv6() {
  return address.ipv6();
}

/**
 * 异步获取本机 MAC 地址
 * @returns {Promise<string>} MAC 地址
 */
export function getMac() {
  return new Promise((resolve, reject) => {
    address.mac((err, addr) => {
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
  const ip = getIp();
  const ipv6 = getIpv6();
  let mac;
  try {
    mac = await getMac();
  } catch (err) {
    mac = String(err);
  }
  return { ip, ipv6, mac };
}
