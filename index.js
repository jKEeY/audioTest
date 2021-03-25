function renderAudio(context) {
  return new Promise((resolve, reject) => {
    context.oncomplete = (event) => resolve(event.renderedBuffer)

    // 3 tries to start the context when the page is in foreground
    let resumeTriesLeft = 3

    const tryResume = () => {
      context.startRendering()

      switch (context.state) {
        case 'running':
          // The context has started calculating the audio signal. Start a plain timeout.
          setTimeout(() => reject(new Error('Timeout')), 1000)
          break
        case 'suspended':
          // Don’t count the tries when the page is in background
          if (!document.hidden) {
            resumeTriesLeft--
          }
          if (resumeTriesLeft > 0) {
            setTimeout(tryResume, 500) // There is a delay before a retry
          } else {
            reject(new Error('Suspended'))
          }
          break
      }
    }

    tryResume()
  })
}

const AudioContex = window.OfflineAudioContext || window.webkitOfflineAudioContext

function getFingerprint() {
  return new Promise((resolve, _) => {
    function calculateHash(samples) {
      let hash = 0
      for (let i = 0; i < samples.length; ++i) {
        hash += Math.abs(samples[i])
      }
      return hash
    }
    
    const context = new AudioContex(1, 5000, 44100)
    
    const oscillator = context.createOscillator()
    oscillator.type = "triangle"
    oscillator.frequency.value = 1000
    
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -50
    compressor.knee.value = 40
    compressor.ratio.value = 12
    compressor.reduction.value = 20
    compressor.attack.value = 0
    compressor.release.value = 0.2
    
    oscillator.connect(compressor)
    compressor.connect(context.destination);
    
    oscillator.start()
    context.oncomplete = event => {
      // We have only one channel, so we get it by index
      const samples = event.renderedBuffer.getChannelData(0)
    
      resolve(calculateHash(samples))
      
    };
    context.startRendering()    
  })
}

async function getFudgeFactor() {
  const context = new AudioContex(1, 1, 44100)
  const inputBuffer = context.createBuffer(1, 1, 44100)
  inputBuffer.getChannelData(0)[0] = 1

  const inputNode = context.createBufferSource()
  inputNode.buffer = inputBuffer
  inputNode.connect(context.destination)
  inputNode.start()

  // See the renderAudio implementation 
  // at https://git.io/Jmw1j
  const outputBuffer = await renderAudio(context)
  return outputBuffer.getChannelData(0)[0]
}


(async () => {

  const [fingerprint, fudgeFactor] = await Promise.all([
    // This function is the fingerprint algorithm described
    // in the “How audio fingerprint is calculated” section
    getFingerprint(),
    getFudgeFactor(),
  ])
  const restoredFingerprint = fingerprint / fudgeFactor

  const div = document.createElement('div')
  div.style = 'font-size: 30px'
  div.innerHTML = restoredFingerprint
  document.body.appendChild(div)

})()


var input = document.getElementById('test')

input.addEventListener('keyup', (event) => {
  alert(event.target.value)
})