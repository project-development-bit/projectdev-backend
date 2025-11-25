//IP Address Utility Functions
const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',');
    const clientIp = ips[0].trim();

    if (clientIp) {
      return clientIp;
    }
  }

  // Fallback to socket remote address
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress;

  if (socketIp) {
    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    return socketIp.replace(/^::ffff:/, '');
  }

  return 'unknown';
};



module.exports = {
  getClientIp
};
