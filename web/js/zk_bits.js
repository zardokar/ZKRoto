// LOGICAL (pure): decode the frame number that zkroto_test_2997.mp4 draws as 16 white / black squares.
const CHANNELS = 3;
const STRIDE = 4;

export function bitCenters(spec) {
  const out = [];
  for (let k = 0; k < spec.bits; k += 1) {
    out.push([spec.x0 + k * spec.step + spec.size / 2, spec.y + spec.size / 2]);
  }
  return out;
}

export function meanBrightness(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += STRIDE) {
    sum += data[i] + data[i + 1] + data[i + 2];
  }
  return sum / (data.length / STRIDE) / CHANNELS;
}

export function decodeBits(means, threshold) {
  let n = 0;
  means.forEach(function (m, k) {
    if (m > threshold) {
      n |= 1 << k;
    }
  });
  return n;
}
