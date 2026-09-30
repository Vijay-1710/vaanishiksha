// Comprehensive Mock Data Store for Vercel Cloud Deployment & Offline Testing

export interface DemoUser {
  id: number
  email: string
  full_name: string
  role: 'teacher' | 'student'
  preferred_language: string
  grade_level: number
}

export const DEMO_TEACHER: DemoUser = {
  id: 101,
  email: 'teacher@vaanishiksha.edu',
  full_name: 'Dr. Ramesh Sharma',
  role: 'teacher',
  preferred_language: 'en',
  grade_level: 5,
}

export const DEMO_STUDENT: DemoUser = {
  id: 202,
  email: 'student@vaanishiksha.edu',
  full_name: 'Aarav Patel',
  role: 'student',
  preferred_language: 'hi',
  grade_level: 5,
}

export interface DemoLecture {
  id: number
  title: string
  description: string | null
  subject: string | null
  grade_level: number | null
  original_language: string
  media_url?: string | null
  media_type?: 'audio' | 'video'
  created_at: string
  has_transcript: boolean
  transcript_text?: string
  available_languages: string[]
}

export const DEMO_LECTURES: DemoLecture[] = [
  {
    id: 1,
    title: 'The Water Cycle and Weather Patterns (जल चक्र और मौसम)',
    description: 'Detailed explanation of evaporation, condensation, precipitation, and rain for primary science.',
    subject: 'General Science',
    grade_level: 5,
    original_language: 'en',
    media_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=nature-sound-rain-112002.mp3',
    media_type: 'audio',
    created_at: '2026-09-30T10:00:00Z',
    has_transcript: true,
    transcript_text: 'Hello students! Welcome to our science lesson on the water cycle. The sun warms water in rivers, lakes, and oceans. This water turns into invisible vapor through evaporation. As vapor rises high into the cool air, it condenses to form rain clouds. When clouds become heavy, precipitation falls as nourishing rain back into the soil and rivers.',
    available_languages: ['en', 'hi', 'ta', 'te', 'kn', 'bn'],
  },
  {
    id: 2,
    title: 'Plant Parts and Photosynthesis (पौधों के भाग एवं प्रकाश संश्लेषण)',
    description: 'Learn how green leaves use sunlight and chlorophyll to produce food for the plant.',
    subject: 'Science',
    grade_level: 4,
    original_language: 'en',
    media_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=nature-sound-rain-112002.mp3',
    media_type: 'audio',
    created_at: '2026-09-30T11:00:00Z',
    has_transcript: true,
    transcript_text: 'Plants are miraculous living organisms. The root anchors the plant into soil and absorbs vital minerals. Leaves contain chlorophyll, a special pigment that traps sunlight. Through photosynthesis, water and carbon dioxide are transformed into energy and oxygen.',
    available_languages: ['en', 'hi', 'ta', 'te'],
  },
  {
    id: 3,
    title: 'Our Solar System and the Earth (हमारा सौर मंडल और पृथ्वी)',
    description: 'Exploration of planets, the sun, day and night cycles, and earth’s atmosphere.',
    subject: 'Environmental Studies',
    grade_level: 3,
    original_language: 'en',
    media_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=nature-sound-rain-112002.mp3',
    media_type: 'audio',
    created_at: '2026-09-30T12:00:00Z',
    has_transcript: true,
    transcript_text: 'The sun is the glowing star at the center of our solar system. Eight planets revolve around the sun in fixed orbits. Mercury is closest, Venus is bright, and our Earth is the third planet having water and life.',
    available_languages: ['en', 'hi', 'kn', 'bn'],
  },
]

export const DEMO_TRANSLATIONS: Record<string, Record<string, string>> = {
  '1': {
    en: 'Hello students! Welcome to our science lesson on the water cycle. The sun warms water in rivers, lakes, and oceans. This water turns into invisible vapor through evaporation. As vapor rises high into the cool air, it condenses to form rain clouds. When clouds become heavy, precipitation falls as nourishing rain back into the soil and rivers.',
    hi: 'नमस्ते विद्यार्थियों! जल चक्र पर हमारे विज्ञान पाठ में आपका स्वागत है। सूर्य नदियों, झीलों और महासागरों में पानी को गर्म करता है। यह पानी वाष्पीकरण के माध्यम से अदृश्य वाष्प में बदल जाता है। जैसे ही वाष्प ठंडी हवा में ऊपर उठती है, यह वर्षा के बादल बनाने के लिए संघनित होती है। जब बादल भारी हो जाते हैं, तो वर्षा मिट्टी और नदियों में जीवनदायी बारिश के रूप में गिरती है।',
    ta: 'வணக்கம் மாணவர்களே! நீர் சுழற்சி குறித்த நமது அறிவியல் பாடத்திற்கு வரவேற்கிறோம். சூரியன் ஆறுகள், ஏரிகள் மற்றும் பெருங்கடல்களில் உள்ள தண்ணீரை சூடாக்குகிறது. இந்த நீர் ஆவியாதல் மூலம் கண்ணுக்கு தெரியாத நீராவியாக மாறுகிறது. நீராவி குளிர்ந்த காற்றில் மேலே உயரும் போது, அது மேகங்களாக ஒடுங்குகிறது. மேகங்கள் கனமாகும்போது, மழை பொழிகிறது.',
    te: 'నమస్కారం విద్యార్థులారా! నీటి చక్రంపై మన సైన్స్ పాఠానికి స్వాగతం. సూర్యుడు నదులు, సరస్సులు మరియు మహాసముద్రాలలోని నీటిని వేడి చేస్తాడు. ఈ నీరు భాష్పీభవనం ద్వారా అదృశ్య ఆవిరిగా మారుతుంది. ఆవిరి చల్లని గాలిలోకి పైకి లేచినప్పుడు, అది వర్షపు మేఘాలుగా ఘనీభవిస్తుంది. మేఘాలు బరువుగా మారినప్పుడు వర్షం కురుస్తుంది.',
    kn: 'ನಮಸ್ಕಾರ ವಿದ್ಯಾರ್ಥಿಗಳೇ! ಜಲಚಕ್ರದ ನಮ್ಮ ವಿಜ್ಞಾನ ಪಾಠಕ್ಕೆ ಸ್ವಾಗತ. ಸೂರ್ಯನು ನದಿಗಳು, ಸರೋವರಗಳು ಮತ್ತು ಸಾಗರಗಳಲ್ಲಿನ ನೀರನ್ನು ಬಿಸಿಮಾಡುತ್ತಾನೆ. ಈ ನೀರು ಆವಿಯಾಗುವಿಕೆಯ ಮೂಲಕ ಅದೃಶ್ಯ ಆವಿಯಾಗಿ ಬದಲಾಗುತ್ತದೆ. ಆವಿಯು ತಂಪಾದ ಗಾಳಿಯಲ್ಲಿ ಮೇಲಕ್ಕೆ ಏರುತ್ತಿದ್ದಂತೆ, ಅದು ಮಳೆ ಮೋಡಗಳಾಗಿ ಸಾಂದ್ರೀಕರಿಸುತ್ತದೆ. ಮೋಡಗಳು ಭಾರವಾದಾಗ ಮಳೆ ಸುರಿಯುತ್ತದೆ.',
    bn: 'নমস্কার শিক্ষার্থীরা! জলচক্র সম্পর্কিত আমাদের বিজ্ঞান পাঠে স্বাগতম। সূর্য নদী, হ্রদ এবং সমুদ্রের জলকে উত্তপ্ত করে। এই জল বাষ্পীভবনের মাধ্যমে অদৃশ্য বাষ্পে পরিণত হয়। বাষ্প যখন ঠান্ডা বাতাসে উপরে ওঠে, তখন এটি মেঘ তৈরি করে ঘনীভূত হয়। মেঘ ভারী হলে বৃষ্টিপাত হয়ে মাটিতে ফিরে আসে।',
  },
}

export const DEMO_NCERT_OVERVIEW = {
  board: 'NCERT',
  country: 'India',
  total_chapters: 28,
  classes: [
    { grade_level: 1, grade_name: 'Class 1 (Balvatika / Primary)', chapter_count: 3, subjects: ['Mathematics', 'Hindi', 'English'], books: ['Math-Magic', 'Sarangi', 'Mridang'] },
    { grade_level: 2, grade_name: 'Class 2 (Primary)', chapter_count: 3, subjects: ['Mathematics', 'Hindi', 'English'], books: ['Joyful Mathematics', 'Sarangi', 'Mridang'] },
    { grade_level: 3, grade_name: 'Class 3 (Primary)', chapter_count: 4, subjects: ['Environmental Studies', 'Mathematics', 'Hindi', 'English'], books: ['Looking Around', 'Math-Magic', 'Veena', 'Santoor'] },
    { grade_level: 4, grade_name: 'Class 4 (Primary)', chapter_count: 4, subjects: ['Environmental Studies', 'Mathematics', 'Hindi', 'English'], books: ['Looking Around', 'Math-Magic', 'Rimjhim', 'Marigold'] },
    { grade_level: 5, grade_name: 'Class 5 (Primary Graduation)', chapter_count: 5, subjects: ['Environmental Studies', 'Mathematics', 'Hindi', 'English'], books: ['Looking Around', 'Math-Magic', 'Rimjhim', 'Marigold'] },
    { grade_level: 6, grade_name: 'Class 6 (Middle School)', chapter_count: 3, subjects: ['Science', 'Mathematics', 'Social Science'], books: ['Curiosity Science', 'Ganita Prakash', 'Exploring Society'] },
    { grade_level: 7, grade_name: 'Class 7 (Middle School)', chapter_count: 3, subjects: ['Science', 'Mathematics', 'Social Science'], books: ['Science', 'Mathematics', 'Our Pasts'] },
    { grade_level: 8, grade_name: 'Class 8 (Middle School)', chapter_count: 3, subjects: ['Science', 'Mathematics', 'Social Science'], books: ['Science', 'Mathematics', 'Resource and Development'] },
  ],
}

export const DEMO_NCERT_CHAPTERS = [
  {
    id: 'ncert-c5-evs-ch1',
    grade_level: 5,
    subject: 'Environmental Studies',
    book_name: 'Looking Around',
    book_hindi_name: 'आस-पास',
    chapter_number: 1,
    title: 'Super Senses (सुपर सेंसेज)',
    title_hindi: 'कैसे पहचाना चींटी ने दोस्त को?',
    description: 'Explores how animals hear, see, smell, and perceive vibrations across natural habitats.',
    core_concepts: ['Animal sensory powers', 'Silk moth and scent tracking', 'Eagle sight distance', 'Ant pheromone trails'],
    learning_outcomes: ['Students identify diverse sensory adaptations in wildlife.'],
    official_pdf_url: 'https://ncert.nic.in/textbook.php?eeap1=1-22',
  },
  {
    id: 'ncert-c5-evs-ch2',
    grade_level: 5,
    subject: 'Environmental Studies',
    book_name: 'Looking Around',
    book_hindi_name: 'आस-पास',
    chapter_number: 2,
    title: 'A Snake Charmer’s Story',
    title_hindi: 'कहानी सपेरों की',
    description: 'Cultural history of the Kalbeliya community and wildlife conservation laws in India.',
    core_concepts: ['Kalbeliya folk traditions', 'Poisonous and non-poisonous snakes', 'Wildlife Protection Act'],
    learning_outcomes: ['Understanding co-existence with biodiversity.'],
    official_pdf_url: 'https://ncert.nic.in/textbook.php?eeap1=2-22',
  },
  {
    id: 'ncert-c5-evs-ch7',
    grade_level: 5,
    subject: 'Environmental Studies',
    book_name: 'Looking Around',
    book_hindi_name: 'आस-पास',
    chapter_number: 7,
    title: 'Experiments with Water',
    title_hindi: 'पानी के प्रयोग',
    description: 'Floating, sinking, solubility, and the historic Dandi March salt extraction principles.',
    core_concepts: ['Density and buoyancy', 'Solutes and solvents', 'Salt production from seawater'],
    learning_outcomes: ['Conducting simple scientific experiments with water.'],
    official_pdf_url: 'https://ncert.nic.in/textbook.php?eeap1=7-22',
  },
  {
    id: 'ncert-c6-sci-ch1',
    grade_level: 6,
    subject: 'Science',
    book_name: 'Curiosity Science',
    book_hindi_name: 'जिज्ञासा विज्ञान',
    chapter_number: 1,
    title: 'Components of Food (भोजन के घटक)',
    title_hindi: 'भोजन के घातक',
    description: 'Nutrients, carbohydrates, proteins, fats, vitamins, and deficiency diseases.',
    core_concepts: ['Balanced diet', 'Iodine test for starch', 'Biuret test for proteins', 'Deficiency diseases'],
    learning_outcomes: ['Students recognize essential nutritional components.'],
    official_pdf_url: 'https://ncert.nic.in/textbook.php?fesc1=1-16',
  },
]

export const DEMO_WORKSHEET_CONTENT = {
  title: 'The Water Cycle & Living Ecosystems (जल चक्र और जीवित पारिस्थितिकी तंत्र)',
  summary: [
    'The water cycle is the continuous movement of water on, above, and below the surface of the Earth.',
    'Evaporation happens when the sun heats water bodies, transforming liquid into water vapor.',
    'Condensation occurs high in the atmosphere, creating clouds as water vapor cools down.',
    'Precipitation delivers fresh water back to soil, replenishing ground water and rivers.',
  ],
  vocabulary: [
    { term: 'Evaporation (वाष्पीकरण)', definition: 'Process where liquid water turns into invisible gas or vapor due to warmth.' },
    { term: 'Condensation (संघनन)', definition: 'Cooling of water vapor turning back into liquid water droplets to form clouds.' },
    { term: 'Precipitation (वर्षण)', definition: 'Water released from clouds in the form of rain, freezing rain, sleet, snow, or hail.' },
    { term: 'Chlorophyll (पर्णहरित)', definition: 'The green pigment inside plant leaves that captures sunlight energy.' },
  ],
  mcqs: [
    {
      question: 'Which celestial body provides the heat energy driving the Earth’s water cycle?',
      options: ['The Moon', 'The Sun', 'The Stars', 'Wind Currents'],
      correct_answer: 1,
      explanation: 'The sun warms water in rivers and oceans, causing it to evaporate into vapor.',
    },
    {
      question: 'What is formed when water vapor condenses in the cool upper atmosphere?',
      options: ['Desert Sand', 'Clouds', 'Volcanic Ash', 'Rainbow Rocks'],
      correct_answer: 1,
      explanation: 'Cooling vapor gathers as droplets, creating visible clouds in the sky.',
    },
    {
      question: 'What substance in green leaves captures sunlight for photosynthesis?',
      options: ['Calcium', 'Chlorophyll', 'Iron', 'Salt'],
      correct_answer: 1,
      explanation: 'Chlorophyll is the green pigment in leaves responsible for trapping solar energy.',
    },
  ],
  fill_in_the_blanks: [
    {
      sentence: 'The process of liquid water converting into water vapor is called ______.',
      answer: 'Evaporation',
    },
    {
      sentence: 'Plant roots absorb water and vital minerals from the ______.',
      answer: 'Soil',
    },
    {
      sentence: 'When clouds become too heavy with water droplets, ______ falls to the ground.',
      answer: 'Rain (Precipitation)',
    },
  ],
  short_questions: [
    {
      question: 'Explain why the water cycle is essential for farmers and primary agriculture.',
      sample_answer: 'The water cycle continually replenishes fresh rainwater in soil, rivers, and ponds, providing crops with the water needed to grow food.',
    },
    {
      question: 'How do plants participate in the water cycle?',
      sample_answer: 'Plants absorb water through roots and release vapor into the air through transpiration from their leaves.',
    },
  ],
}
