import sdk from 'microsoft-cognitiveservices-speech-sdk';
import { AppError } from '../utils/errorHandler.js';

let mockTTSProviderHandler = null;

/**
 * Set mock provider handler for testing
 * @param {Function|null} handler
 */
export function setMockTTSProvider(handler) {
  mockTTSProviderHandler = handler;
}

/**
 * Reset mock provider handler
 */
export function resetMockTTSProvider() {
  mockTTSProviderHandler = null;
}

/**
 * Validate Azure Speech environment configuration
 */
function getAzureSpeechConfig(options = {}) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;
  const defaultVoice = process.env.AZURE_SPEECH_VOICE || 'de-DE-ConradNeural';

  if (!speechKey) {
    throw new AppError('AZURE_SPEECH_KEY is not configured on the server.', 500);
  }

  if (!speechRegion) {
    throw new AppError('AZURE_SPEECH_REGION is not configured on the server.', 500);
  }

  const voice = options.voice || defaultVoice;
  const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);

  speechConfig.speechSynthesisLanguage = 'de-DE';
  speechConfig.speechSynthesisVoiceName = voice;
  speechConfig.speechSynthesisOutputFormat =
    options.outputFormat || sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

  return speechConfig;
}

/**
 * Synthesize German text into an MP3 audio buffer using Azure Speech SDK
 *
 * @param {string} text - German text or SSML
 * @param {Object} [options]
 * @param {string} [options.voice] - Override voice name (e.g. 'de-DE-KatjaNeural')
 * @param {boolean} [options.ssml] - Whether the text is raw SSML
 * @param {number} [options.timeoutMs=15000] - Synthesis timeout in milliseconds
 * @returns {Promise<Buffer>} Audio buffer in audio/mpeg format
 */
export async function generateGermanTTS(text, options = {}) {
  if (mockTTSProviderHandler) {
    return mockTTSProviderHandler(text, options);
  }

  if (text === undefined || text === null || typeof text !== 'string') {
    throw new AppError('Text must be a valid string.', 400);
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new AppError('Text is required and cannot be empty.', 400);
  }

  const maxLength = options.maxLength || 2000;
  if (trimmedText.length > maxLength) {
    throw new AppError(`Text exceeds maximum allowed length of ${maxLength} characters.`, 400);
  }

  const speechConfig = getAzureSpeechConfig(options);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
  const timeoutMs = options.timeoutMs || 15000;

  return new Promise((resolve, reject) => {
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          synthesizer.close();
        } catch (_) {}
        reject(new AppError('Azure Speech synthesis request timed out.', 504));
      }
    }, timeoutMs);

    const handleSuccess = (result) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      try {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioBuffer = Buffer.from(result.audioData);
          synthesizer.close();
          resolve(audioBuffer);
        } else if (result.reason === sdk.ResultReason.Canceled) {
          const cancellation = sdk.CancellationDetails.fromResult(result);
          synthesizer.close();

          let errorMessage = 'Azure Speech synthesis was canceled.';
          let statusCode = 502;

          if (
            cancellation.ErrorCode === sdk.CancellationErrorCode.AuthenticationFailure ||
            (cancellation.errorDetails && cancellation.errorDetails.includes('1006'))
          ) {
            errorMessage = 'Azure Speech authentication or connection failed. Please check credentials.';
            statusCode = 500;
          } else if (cancellation.errorDetails) {
            errorMessage = `Azure Speech synthesis error: ${cancellation.errorDetails}`;
          }

          reject(new AppError(errorMessage, statusCode));
        } else {
          synthesizer.close();
          reject(
            new AppError(`Azure Speech synthesis stopped with unexpected reason: ${result.reason}`, 502)
          );
        }
      } catch (err) {
        synthesizer.close();
        reject(err);
      }
    };

    const handleError = (error) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      try {
        synthesizer.close();
      } catch (_) {}

      reject(
        new AppError(
          `Azure Speech SDK communication error: ${error?.message || error || 'Unknown error'}`,
          502
        )
      );
    };

    const isSsml = options.ssml || trimmedText.startsWith('<speak');
    if (isSsml) {
      synthesizer.speakSsmlAsync(trimmedText, handleSuccess, handleError);
    } else {
      synthesizer.speakTextAsync(trimmedText, handleSuccess, handleError);
    }
  });
}

export default {
  generateGermanTTS,
  setMockTTSProvider,
  resetMockTTSProvider,
};
