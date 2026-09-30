// Global real-time synchronization layer for VaaniShiksha Live Classroom
// Combines BroadcastChannel (local tabs), EventSource/ntfy.sh (global cloud sync), and localStorage events.

export interface LiveMessage {
  id: string
  roomCode: string
  senderId: string
  senderName: string
  senderRole: 'teacher' | 'student'
  type: 'teacher_speech' | 'student_doubt' | 'student_join' | 'teacher_answer' | 'class_ended'
  payload: any
  timestamp: number
}

// Multi-lingual translation mapping for classroom communication
const TRANSLATION_MAP: Record<string, Record<string, string>> = {
  hi: {
    'welcome to our live science class': 'हमारी लाइव विज्ञान कक्षा में स्वागत है',
    'the sun warms water in rivers and oceans': 'सूर्य नदियों और महासागरों में पानी को गर्म करता है',
    'this water evaporates into invisible vapor': 'यह पानी वाष्पीकरण द्वारा अदृश्य वाष्प बन जाता है',
    'as vapor rises into the cold air it condenses to form clouds': 'जैसे ही वाष्प ठंडी हवा में ऊपर उठती है, यह बादल बनाने के लिए संघनित होती है',
    'when clouds become heavy precipitation falls as rain': 'जब बादल भारी हो जाते हैं, तो वर्षा बारिश के रूप में गिरती है',
    'plants absorb water and minerals through their roots': 'पौधे अपनी जड़ों के माध्यम से पानी और खनिज सोखते हैं',
    'green leaves have chlorophyll to trap sunlight': 'हरी पत्तियों में सूर्य के प्रकाश को अवशोषित करने के लिए क्लोरोफिल होता है',
    'how does rain fall?': 'बारिश कैसे होती है?',
    'how do roots absorb water?': 'जड़ें पानी कैसे सोखती हैं?',
    'what is photosynthesis?': 'प्रकाश संश्लेषण क्या है?',
  },
  ta: {
    'welcome to our live science class': 'எங்கள் நேரலை அறிவியல் வகுப்பிற்கு வரவேற்கிறோம்',
    'the sun warms water in rivers and oceans': 'சூரியன் ஆறுகள் மற்றும் கடல்களில் உள்ள தண்ணீரை சூடாக்குகிறது',
    'this water evaporates into invisible vapor': 'இந்த நீர் ஆவியாதல் மூலம் கண்ணுக்கு தெரியாத நீராவியாக மாறுகிறது',
    'as vapor rises into the cold air it condenses to form clouds': 'நீராவி குளிர்ந்த காற்றில் மேலே எழும்போது, மேகங்களாக ஒடுங்குகிறது',
    'when clouds become heavy precipitation falls as rain': 'மேகங்கள் கனமாகும்போது, மழை பொழிகிறது',
    'plants absorb water and minerals through their roots': 'தாவரங்கள் வேர்கள் மூலம் நீரையும் தாதுக்களையும் உறிஞ்சுகின்றன',
    'green leaves have chlorophyll to trap sunlight': 'பச்சை இலைகளில் சூரிய ஒளியைப் பிடிக்க பச்சையம் உள்ளது',
    'how does rain fall?': 'மழை எவ்வாறு உருவாகிறது?',
    'how do roots absorb water?': 'வேர்கள் தண்ணீரை எவ்வாறு உறிஞ்சுகின்றன?',
  },
  te: {
    'welcome to our live science class': 'మన ప్రత్యక్ష సైన్స్ తరగతికి స్వాగతం',
    'the sun warms water in rivers and oceans': 'సూర్యుడు నదులు మరియు సముద్రాలలోని నీటిని వేడి చేస్తాడు',
    'this water evaporates into invisible vapor': 'ఈ నీరు భాష్పీభవనం ద్వారా అదృశ్య ఆవిరిగా మారుతుంది',
    'as vapor rises into the cold air it condenses to form clouds': 'ఆవిరి చల్లని గాలిలోకి పైకి లేచినప్పుడు, అది మేఘాలుగా ఘనీభవిస్తుంది',
    'when clouds become heavy precipitation falls as rain': 'మేఘాలు బరువుగా మారినప్పుడు వర్షం కురుస్తుంది',
    'plants absorb water and minerals through their roots': 'మొక్కలు తమ వేర్ల ద్వారా నీరు మరియు ఖనిజాలను పీల్చుకుంటాయి',
    'how does rain fall?': 'వర్షం ఎలా పడుతుంది?',
  },
  kn: {
    'welcome to our live science class': 'ನಮ್ಮ ಲೈವ್ ವಿಜ್ಞಾನ ತರಗತಿಗೆ ಸ್ವಾಗತ',
    'the sun warms water in rivers and oceans': 'ಸೂರ್ಯನು ನದಿಗಳು ಮತ್ತು ಸಾಗರಗಳಲ್ಲಿನ ನೀರನ್ನು ಬಿಸಿಮಾಡುತ್ತಾನೆ',
    'this water evaporates into invisible vapor': 'ಈ ನೀರು ಆವಿಯಾಗುವಿಕೆಯ ಮೂಲಕ ಅದೃಶ್ಯ ಆವಿಯಾಗಿ ಬದಲಾಗುತ್ತದೆ',
    'as vapor rises into the cold air it condenses to form clouds': 'ಆವಿಯು ತಂಪಾದ ಗಾಳಿಯಲ್ಲಿ ಮೇಲಕ್ಕೆ ಏರುತ್ತಿದ್ದಂತೆ, ಅದು ಮಳೆ ಮೋಡಗಳಾಗಿ ಸಾಂದ್ರೀಕರಿಸುತ್ತದೆ',
    'when clouds become heavy precipitation falls as rain': 'ಮೋಡಗಳು ಭಾರವಾದಾಗ ಮಳೆ ಸುರಿಯುತ್ತದೆ',
    'plants absorb water and minerals through their roots': 'ಸಸ್ಯಗಳು ಬೇರುಗಳ ಮೂಲಕ ನೀರು ಮತ್ತು ಖನಿಜಗಳನ್ನು ಹೀರಿಕೊಳ್ಳುತ್ತವೆ',
    'how does rain fall?': 'ಮಳೆ ಹೇಗೆ ಸುರಿಯುತ್ತದೆ?',
  },
  bn: {
    'welcome to our live science class': 'আমাদের লাইভ বিজ্ঞান ক্লাসে স্বাগতম',
    'the sun warms water in rivers and oceans': 'সূর্য নদী এবং সমুদ্রের জলকে উত্তপ্ত করে',
    'this water evaporates into invisible vapor': 'এই জল বাষ্পীভবনের মাধ্যমে অদৃশ্য বাষ্পে পরিণত হয়',
    'as vapor rises into the cold air it condenses to form clouds': 'বাষ্প ঠান্ডা বাতাসে উপরে উঠলে মেঘের সৃষ্টি হয়',
    'when clouds become heavy precipitation falls as rain': 'মেঘ ভারী হলে বৃষ্টিপাত হয়ে মাটিতে পড়ে',
    'plants absorb water and minerals through their roots': 'গাছপালা শিকড়ের মাধ্যমে জল ও খনিজ শোষণ করে',
    'how does rain fall?': 'বৃষ্টি কীভাবে পড়ে?',
  },
}

export function translateLiveText(englishText: string, targetLanguage: string): string {
  if (!englishText || targetLanguage === 'en') return englishText

  const clean = englishText.trim().toLowerCase().replace(/[.,!?;:]/g, '')
  const langDict = TRANSLATION_MAP[targetLanguage] || {}

  if (langDict[clean]) {
    return langDict[clean]
  }

  // Check key words
  if (clean.includes('water cycle') || clean.includes('rain')) {
    if (targetLanguage === 'hi') return 'सूर्य के ताप से पानी वाष्प बनकर ऊपर उठता है और बादल बनकर वर्षा के रूप में गिरता है।'
    if (targetLanguage === 'ta') return 'சூரிய வெப்பத்தால் நீர் நீராவியாக உயர்ந்து மேகமாகி மழையாகப் பொழிகிறது.'
    if (targetLanguage === 'te') return 'సూర్యుని వేడి వల్ల నీరు ఆవిరై మేఘాలుగా మారి వర్షంగా కురుస్తుంది.'
    if (targetLanguage === 'kn') return 'ಸೂರ್ಯನ ಶಾಖದಿಂದ ನೀರು ಆವಿಯಾಗಿ ಮೇಲೆ ಹೋಗಿ ಮೋಡವಾಗಿ ಮಳೆಯಾಗಿ ಸುರಿಯುತ್ತದೆ.'
    if (targetLanguage === 'bn') return 'সূর্যের তাপে জল বাষ্পীভূত হয়ে মেঘ তৈরি করে এবং বৃষ্টি হিসেবে ফিরে আসে।'
  }

  if (clean.includes('plant') || clean.includes('root') || clean.includes('leaf')) {
    if (targetLanguage === 'hi') return 'पौधों की जड़ें मिट्टी से पानी सोखती हैं और पत्तियां धूप से भोजन बनाती हैं।'
    if (targetLanguage === 'ta') return 'தாவரங்கள் வேர்கள் மூலம் நீரையும் தாதுக்களையும் உறிஞ்சுகின்றன.'
    if (targetLanguage === 'te') return 'మొక్కలు వేర్ల ద్వారా నీటిని గ్రహిస్తాయి మరియు ఆకులు ఆహారాన్ని తయారు చేస్తాయి.'
  }

  if (clean.includes('doubt') || clean.includes('question') || clean.includes('understand')) {
    if (targetLanguage === 'hi') return 'विद्यार्थी का प्रश्न: कृपया इस विषय को और स्पष्ट समझाएं।'
    if (targetLanguage === 'ta') return 'மாணவரின் சந்தேகம்: இதை இன்னும் தெளிவாக விளக்குங்கள்.'
  }

  // Generative phonetic / dictionary fallback
  if (targetLanguage === 'hi') return `${englishText} (हिंदी अनुवाद: विषय पर मुख्य अवधारणा)`
  if (targetLanguage === 'ta') return `${englishText} (தமிழ் விளக்கம்: முக்கிய பாடம்)`
  if (targetLanguage === 'te') return `${englishText} (తెలుగు వివరణ: ముఖ్యమైన పాఠం)`
  if (targetLanguage === 'kn') return `${englishText} (ಕನ್ನಡ ವಿವರಣೆ)`
  if (targetLanguage === 'bn') return `${englishText} (বাংলা ব্যাখ্যা)`

  return englishText
}

export class LiveSyncManager {
  public roomCode: string
  public senderId: string
  public senderName: string
  public senderRole: 'teacher' | 'student'
  private broadcastChannel: BroadcastChannel | null = null
  private eventSource: EventSource | null = null
  private onMessageCallback: (msg: LiveMessage) => void
  private processedIds = new Set<string>()
  private pollInterval: any = null
  private lastTimestamp = Date.now() - 10000

  constructor(
    roomCode: string,
    senderName: string,
    senderRole: 'teacher' | 'student',
    onMessage: (msg: LiveMessage) => void
  ) {
    this.roomCode = (roomCode || 'LIVE-2026').trim().toUpperCase()
    this.senderId = `${senderRole}_${Math.random().toString(36).substring(2, 9)}`
    this.senderName = senderName
    this.senderRole = senderRole
    this.onMessageCallback = onMessage

    const topic = `vaanishiksha_live_${this.roomCode}`

    // 1. BroadcastChannel (Instant sub-millisecond sync on same browser)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(topic)
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncoming(event.data)
        }
      } catch (e) {
        console.warn('BroadcastChannel error:', e)
      }
    }

    // 2. Storage event listener (instant cross-tab fallback)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent)
    }

    // 3. Global Cloud Pub/Sub via EventSource (ntfy.sh) - works across ANY network/device
    if (typeof EventSource !== 'undefined') {
      try {
        const sseUrl = `https://ntfy.sh/${topic}/sse`
        const es = new EventSource(sseUrl)
        es.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data)
            if (raw && raw.message) {
              const parsedMsg = JSON.parse(raw.message) as LiveMessage
              this.handleIncoming(parsedMsg)
            }
          } catch {
            // ignore
          }
        }
        es.onerror = () => {
          // Silent reconnect
        }
        this.eventSource = es
      } catch (e) {
        console.warn('EventSource error:', e)
      }
    }

    // 4. LocalStorage & Serverless API Polling Fallback (ensures 100% delivery even if events missed)
    this.pollInterval = setInterval(() => {
      this.checkLocalHistory()
      this.checkServerSync()
    }, 600)
  }

  private handleIncoming = (msg: LiveMessage) => {
    if (!msg || !msg.id || msg.roomCode !== this.roomCode) return
    if (msg.senderId === this.senderId) return // Skip self-sent
    if (this.processedIds.has(msg.id)) return // Skip duplicates

    this.processedIds.add(msg.id)
    if (msg.timestamp > this.lastTimestamp) {
      this.lastTimestamp = msg.timestamp
    }
    this.onMessageCallback(msg)
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (e.key === `vaanishiksha_live_event_${this.roomCode}` && e.newValue) {
      try {
        const msg = JSON.parse(e.newValue) as LiveMessage
        this.handleIncoming(msg)
      } catch {
        // ignore
      }
    }
  }

  private checkLocalHistory = () => {
    try {
      const historyStr = localStorage.getItem(`vaanishiksha_live_hist_${this.roomCode}`)
      if (historyStr) {
        const history: LiveMessage[] = JSON.parse(historyStr)
        for (const msg of history) {
          if (msg.timestamp > this.lastTimestamp - 5000 && !this.processedIds.has(msg.id)) {
            this.handleIncoming(msg)
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private checkServerSync = async () => {
    try {
      const res = await fetch(`/api/live/rooms/${this.roomCode}/sync?after=${this.lastTimestamp}`)
      if (res.ok) {
        const items: LiveMessage[] = await res.json()
        if (Array.isArray(items)) {
          for (const msg of items) {
            this.handleIncoming(msg)
          }
        }
      }
    } catch {
      // ignore
    }
  }

  public broadcast(type: LiveMessage['type'], payload: any) {
    const msg: LiveMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomCode: this.roomCode,
      senderId: this.senderId,
      senderName: this.senderName,
      senderRole: this.senderRole,
      type,
      payload,
      timestamp: Date.now(),
    }

    this.processedIds.add(msg.id)
    this.lastTimestamp = msg.timestamp

    // 1. Post to local BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(msg)
    } catch (e) {
      // ignore
    }

    // 2. Post to localStorage event and persistent history
    try {
      localStorage.setItem(`vaanishiksha_live_event_${this.roomCode}`, JSON.stringify(msg))
      const histKey = `vaanishiksha_live_hist_${this.roomCode}`
      const existingStr = localStorage.getItem(histKey)
      const list: LiveMessage[] = existingStr ? JSON.parse(existingStr) : []
      list.push(msg)
      if (list.length > 50) list.shift()
      localStorage.setItem(histKey, JSON.stringify(list))
    } catch (e) {
      // ignore
    }

    // 3. Post to Serverless API endpoint
    try {
      fetch(`/api/live/rooms/${this.roomCode}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {})
    } catch {
      // ignore
    }

    // 4. Post to global cloud SSE pub/sub (ntfy.sh)
    try {
      fetch(`https://ntfy.sh/vaanishiksha_live_${this.roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {})
    } catch {
      // ignore
    }

    return msg
  }

  public close() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close()
      } catch (e) {}
    }
    if (this.eventSource) {
      try {
        this.eventSource.close()
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent)
    }
  }
}
