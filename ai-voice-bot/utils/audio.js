const MU_LAW_BIAS = 0x84;
const MU_LAW_CLIP = 32635;

const linearToMulaw = (sample) => {
  let sign = 0;
  if (sample < 0) {
    sample = -sample;
    sign = 0x80;
  }

  if (sample > MU_LAW_CLIP) {
    sample = MU_LAW_CLIP;
  }

  sample += MU_LAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent -= 1;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const muLawByte = ~(sign | (exponent << 4) | mantissa);

  return muLawByte & 0xff;
};

const mulawToLinear = (muLawByte) => {
  const u = ~muLawByte & 0xff;
  const sign = (u & 0x80) ? -1 : 1;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const sample = ((mantissa << 3) + MU_LAW_BIAS) << (exponent + 3);
  return sign * sample;
};

export const decodeTwilioAudio = (payloadBase64) => {
  const muLawBuffer = Buffer.from(payloadBase64, 'base64');
  const pcmBuffer = Buffer.alloc(muLawBuffer.length * 2);

  for (let i = 0; i < muLawBuffer.length; i += 1) {
    const sample = mulawToLinear(muLawBuffer[i]);
    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
};

const encodeMulawFrame = (pcmBuffer) => {
  const frame = Buffer.alloc(pcmBuffer.length / 2);
  for (let i = 0; i < frame.length; i += 1) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    frame[i] = linearToMulaw(sample);
  }
  return frame;
};

export const encodePcmToTwilioBase64Frames = (pcmBase64) => {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const samples = pcmBuffer.length / 2;
  const frameSampleCount = 160; // 20ms @ 8kHz
  const frames = [];

  for (let offset = 0; offset < samples; offset += frameSampleCount) {
    const end = Math.min(samples, offset + frameSampleCount);
    const chunk = pcmBuffer.subarray(offset * 2, end * 2);
    const muLawFrame = encodeMulawFrame(chunk);
    frames.push(muLawFrame.toString('base64'));
  }

  return frames;
};
