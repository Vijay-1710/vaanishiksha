"""
NCERT Curriculum Dataset for Primary and Upper Primary Education (Classes 1 to 8).
Standardized according to National Council of Educational Research and Training (NCERT) syllabus.
Provides book titles, chapter metadata, core concepts, learning outcomes, and lecture scripts.
"""

from typing import List, Dict, Any

NCERT_CURRICULUM: List[Dict[str, Any]] = [
    # ==========================================
    # CLASS 1
    # ==========================================
    {
        "id": "ncert-c1-math-ch1",
        "grade_level": 1,
        "subject": "Mathematics",
        "book_name": "Math-Magic",
        "book_hindi_name": "गणित का जादू",
        "chapter_number": 1,
        "title": "Shapes and Space",
        "title_hindi": "आकृतियाँ और स्थान",
        "description": "Understanding basic spatial concepts like inside, outside, bigger, smaller, top, and bottom through playful everyday objects.",
        "core_concepts": [
            "Inside and Outside (अंदर और बाहर)",
            "Bigger and Smaller (बड़ा और छोटा)",
            "Top and Bottom (ऊपर और नीचे)",
            "Rolling and Sliding objects (लुढ़कना और खिसकना)",
            "Basic geometric shapes around us (Circle, Square, Triangle)"
        ],
        "learning_outcomes": [
            "Identifies spatial positions and size differences in the immediate environment.",
            "Distinguishes between objects that roll and objects that slide."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?aemh1=1-13",
        "lesson_script": "Hello young learners! Today we explore Shapes and Space. Look around your home. Some things are inside a room, and some are outside in the garden. Look at an elephant and an ant. The elephant is bigger and the ant is smaller. When you throw a ball, does it roll or slide? A round ball rolls, while a flat book slides! Notice the round shape of the sun and the triangular slice of watermelon. Practice spotting different shapes all around you today."
    },
    {
        "id": "ncert-c1-evs-ch1",
        "grade_level": 1,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Joyful Learning",
        "book_hindi_name": "आनंदमयी शिक्षा",
        "chapter_number": 1,
        "title": "My Family and My Surroundings",
        "title_hindi": "मेरा परिवार और मेरा परिवेश",
        "description": "Introduction to family relationships, our home, pets, and the plants in our courtyard.",
        "core_concepts": [
            "Family members: Parents, Grandparents, Siblings",
            "Helping at home",
            "Parts of our home",
            "Caring for plants and domestic animals"
        ],
        "learning_outcomes": [
            "Names family members and explains how we help one another.",
            "Expresses sensitivity towards pets, trees, and neighbors."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php",
        "lesson_script": "Hello children! Today we learn about our family. A family is a group of people who love and care for each other. In our family, we have mother, father, brother, sister, grandfather, and grandmother. We share meals together, read stories, and help clean our house. We also water the flowering plants in our courtyard and give food to friendly animals like dogs and birds. Loving our family makes our home full of joy."
    },

    # ==========================================
    # CLASS 2
    # ==========================================
    {
        "id": "ncert-c2-math-ch1",
        "grade_level": 2,
        "subject": "Mathematics",
        "book_name": "Math-Magic",
        "book_hindi_name": "गणित का जादू",
        "chapter_number": 1,
        "title": "What is Long, What is Round?",
        "title_hindi": "क्या है लंबा, क्या है गोल?",
        "description": "Exploring 3D objects, cylindrical vs spherical shapes, and building stable towers with blocks.",
        "core_concepts": [
            "Distinction between long and round objects",
            "Objects that can roll vs objects that can slide",
            "Objects that can both roll and slide (like a coin)",
            "Building towers with flat surfaces"
        ],
        "learning_outcomes": [
            "Sorts objects into round and long shapes.",
            "Discovers which shapes stack easily to make towers."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?bemh1=1-15",
        "lesson_script": "Welcome students! Today's lesson is: What is Long, What is Round? A cricket bat is long, but a cricket ball is round! A pencil is long, while a bottle cap is round. Let us see a coin. If you roll it on its edge, it rolls. But if you push it flat, it slides! You can stack matchboxes to build a tall tower because they have flat faces. Can you stack round balls? No, they roll away! Look around and find three long objects and three round objects."
    },

    # ==========================================
    # CLASS 3
    # ==========================================
    {
        "id": "ncert-c3-evs-ch1",
        "grade_level": 3,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Looking Around",
        "book_hindi_name": "आस-पास",
        "chapter_number": 1,
        "title": "Poonam's Day Out",
        "title_hindi": "पूनम की दिनचर्या",
        "description": "Observing different animals, birds, and insects in nature, their habitats, sounds, and movements.",
        "core_concepts": [
            "Diversity of animals in our surroundings",
            "Habitats: Trees, Ponds, Land, and Underground",
            "Animal movements: Flying, Crawling, Hopping, Swimming",
            "Animal sounds and footprints"
        ],
        "learning_outcomes": [
            "Identifies common animals, birds, and insects around us.",
            "Classifies animals by where they live and how they move."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?ceap1=1-24",
        "lesson_script": "Hello students! In this lesson from NCERT Class 3 EVS, we join Poonam on her day out. Poonam sits under a tree and notices many creatures. On the tree, she sees pigeons, squirrels, crows, and butterflies. Near the pond, she spots frogs leaping, ducks paddling, and buffaloes cooling in the water. Some animals walk on four legs, birds fly with wings, snakes crawl on their bellies, and frogs jump with strong back legs. Every creature has a unique role in nature."
    },
    {
        "id": "ncert-c3-evs-ch3",
        "grade_level": 3,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Looking Around",
        "book_hindi_name": "आस-पास",
        "chapter_number": 3,
        "title": "Water O' Water!",
        "title_hindi": "पानी रे पानी!",
        "description": "The importance of water in daily life, sources of water, forms of water, and conservation.",
        "core_concepts": [
            "Daily uses of water: Drinking, Cooking, Bathing, Farming",
            "Natural water sources: Rivers, Lakes, Ponds, Rain, Wells",
            "Three states of water: Solid ice, Liquid water, Steam vapor",
            "Water scarcity and avoiding water wastage"
        ],
        "learning_outcomes": [
            "Understands that water is essential for all living beings.",
            "Learns simple conservation methods to save clean drinking water."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?ceap1=3-24",
        "lesson_script": "Water is life! In this NCERT chapter, we explore how water keeps our world alive. We drink water when we are thirsty, farmers need water to grow grains and fruits, and birds drink from puddles. Rain is our greatest natural source of freshwater. It fills our ponds, wells, and rivers. Water has three wonderful forms: frozen ice on cold mountains, liquid water that flows from taps, and warm steam when water boils. Clean water is precious, so we must never keep taps running wastefully."
    },

    # ==========================================
    # CLASS 4
    # ==========================================
    {
        "id": "ncert-c4-evs-ch1",
        "grade_level": 4,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Looking Around",
        "book_hindi_name": "आस-पास",
        "chapter_number": 1,
        "title": "Going to School",
        "title_hindi": "चलो, चलें स्कूल!",
        "description": "How children across different geographical regions of India overcome obstacles to reach school.",
        "core_concepts": [
            "Bamboo and rope bridges in Assam",
            "Trolley pulley across deep rivers in Ladakh",
            "Vallam small wooden boats in Kerala",
            "Camel-cart in Rajasthan deserts and Bullock-carts in plains",
            "Jugaad vehicles and rocky mountain paths in Uttarakhand"
        ],
        "learning_outcomes": [
            "Appreciates the geographical diversity of India and rural transport modes.",
            "Recognizes the determination of school children across difficult terrains."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?deap1=1-27",
        "lesson_script": "Welcome students! Today's lesson is 'Going to School' from Class 4 NCERT. Across India, children travel to school in astonishing ways. In rainy Assam, kids hold books in one hand and cross rickety bamboo bridges. In Ladakh, children ride high iron cable trolleys using pulleys across wide gorges. In Kerala, students take a small wooden boat called a Vallam. In Rajasthan, camel-carts carry children through sandy dunes, while in Gujarat, a motorized cart called Jugaad carries smiling classmates. No obstacle stops Indian students from gaining education."
    },
    {
        "id": "ncert-c4-evs-ch4",
        "grade_level": 4,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Looking Around",
        "book_hindi_name": "आस-पास",
        "chapter_number": 4,
        "title": "The Story of Amrita",
        "title_hindi": "अमृता की कहानी",
        "description": "The inspiring historical story of Amrita Devi and the Bishnoi community protecting Khejadi trees in Rajasthan.",
        "core_concepts": [
            "The Bishnoi community and their respect for nature",
            "The Khejadi tree and its medicinal/environmental benefits in desert areas",
            "Non-violent protection of trees and wildlife",
            "Importance of forest conservation for environmental balance"
        ],
        "learning_outcomes": [
            "Understands the historical roots of tree hugging (Chipko movement precursor).",
            "Develops environmental empathy towards forest conservation."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?deap1=4-27",
        "lesson_script": "Three hundred years ago, in the village of Khejadli in Rajasthan, lived a brave girl named Amrita. The village had many Khejadi trees that gave shade, sweet pods for food, and bark for medicine in the hot Thar desert. The Bishnoi people believed that 'If trees survive, only then we survive.' When the king's men came with axes to cut down the forest, Amrita and the villagers hugged the trees to shield them. Their sacrifice inspired millions to protect Mother Earth. Today, Khejadli is protected and green."
    },

    # ==========================================
    # CLASS 5
    # ==========================================
    {
        "id": "ncert-c5-evs-ch1",
        "grade_level": 5,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Looking Around",
        "book_hindi_name": "आस-पास",
        "chapter_number": 1,
        "title": "Super Senses",
        "title_hindi": "कैसे पहचाना चींटी ने दोस्त को?",
        "description": "How animals use extraordinary senses of smell, sight, hearing, and vibration to survive and communicate.",
        "core_concepts": [
            "Ants leave scent trails (pheromones) to guide their line",
            "Dogs and their sharp sense of smell for territorial marking",
            "Birds with eyes on opposite sides of their heads vs eagles with 4x human vision",
            "Echolocation and night vision in nocturnal animals like bats and owls",
            "Snakes feeling vibrations on the ground; Tiger's whiskers and roar"
        ],
        "learning_outcomes": [
            "Analyzes how specialized sensory organs help animals find food and avoid danger.",
            "Connects sensory biology to animal behavior and ecosystem survival."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?eeap1=1-22",
        "lesson_script": "Animals have amazing superpowers! Ants follow an invisible chemical scent path left by their queen. That is why ants always march in a neat line! A silkworm moth can find his female from several kilometers away just by her scent. Eagles and kites can spot a tiny mouse on the ground from two kilometers high in the sky. Owls have huge eyes to see clearly in darkness, and tigers can hear the faintest rustle of leaves with their rotating ears. Animals use these super senses to find food and protect their families."
    },
    {
        "id": "ncert-c5-evs-ch5",
        "grade_level": 5,
        "subject": "Environmental Studies (EVS)",
        "book_name": "Looking Around",
        "book_hindi_name": "आस-पास",
        "chapter_number": 5,
        "title": "Seeds and Seeds",
        "title_hindi": "बीज, बीज, बीज",
        "description": "Plant reproduction, seed germination, seed dispersal by wind, water, animals, and explosive pods.",
        "core_concepts": [
            "Conditions for seed germination: Air, Moisture, and warmth",
            "Sprouting pulses (Chana, Moong) and their nutritional value",
            "Modes of seed dispersal: Wind (dandelions), Water (coconuts), Animals (velcro burrs), Pod burst",
            "How explorers brought chillies, potatoes, and tomatoes to India"
        ],
        "learning_outcomes": [
            "Demonstrates seed sprouting through scientific observation.",
            "Explains seed dispersal mechanisms and origin of common crops."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?eeap1=5-22",
        "lesson_script": "Seeds are nature's treasure boxes! A tiny dry seed can sleep for months. But when it gets moisture, air, and warmth, it sprouts green shoots and roots. How do plants travel without feet? Seeds with wings fly on the wind. Coconuts float across ocean waters. Sticky seeds with hooks latch onto animal fur—this inspired the invention of Velcro! Did you know? Green chillies and potatoes originally came to India from South America through seafaring traders. Seeds connect our entire planet."
    },

    # ==========================================
    # CLASS 6
    # ==========================================
    {
        "id": "ncert-c6-sci-ch1",
        "grade_level": 6,
        "subject": "Science",
        "book_name": "Science",
        "book_hindi_name": "विज्ञान",
        "chapter_number": 1,
        "title": "Components of Food",
        "title_hindi": "भोजन के घटक",
        "description": "Nutrients in food: carbohydrates, proteins, fats, vitamins, minerals, dietary fibers, balanced diet, and deficiency diseases.",
        "core_concepts": [
            "Major nutrients: Carbohydrates & Fats (Energy-giving)",
            "Proteins (Body-building nutrients)",
            "Vitamins & Minerals (Protective nutrients)",
            "Roughage (dietary fibre) and water",
            "Balanced diet for growing children",
            "Deficiency diseases: Scurvy, Rickets, Beriberi, Goitre, Anaemia"
        ],
        "learning_outcomes": [
            "Classifies foods according to major nutrient categories.",
            "Designs a balanced meal using affordable local foods.",
            "Identifies common deficiency symptoms and corrective diets."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?fesc1=1-11",
        "lesson_script": "Good food gives us life and energy! In Class 6 Science, we learn the essential components of our food. Carbohydrates in rice, wheat, and potatoes give us quick energy. Fats in ghee and mustard oil store energy for later. Proteins from dal, milk, and eggs build our muscles and heal wounds. Vitamins and minerals like Vitamin C in amla and Iron in spinach shield our body from sickness. If a child does not get enough Vitamin A, they may suffer night blindness. A balanced meal with roti, sabzi, dal, and salad keeps us strong and bright."
    },
    {
        "id": "ncert-c6-geo-ch1",
        "grade_level": 6,
        "subject": "Social Science (Geography)",
        "book_name": "The Earth Our Habitat",
        "book_hindi_name": "पृथ्वी: हमारा आवास",
        "chapter_number": 1,
        "title": "The Earth in the Solar System",
        "title_hindi": "सौरमंडल में पृथ्वी",
        "description": "Celestial bodies, the Sun, eight planets, moons, asteroids, meteoroids, constellations, and Earth as the unique blue planet.",
        "core_concepts": [
            "Celestial bodies: Stars, Planets, Satellites, Asteroids, Comets",
            "Constellations: Ursa Major (Saptarishi) and the Pole Star (Dhruva Tara)",
            "The Sun as the ultimate source of heat and light for the solar system",
            "Eight planets in order from the Sun",
            "Why Earth is called the Blue Planet and the only planet supporting life"
        ],
        "learning_outcomes": [
            "Identifies planets in sequence from the Sun.",
            "Explains the unique conditions (water, atmosphere, temperature) that make life possible on Earth."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?fess2=1-8",
        "lesson_script": "When night falls, millions of shining stars twinkle in the dark sky. Our Sun is a star, and around it revolve eight planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. Earth is the third planet from the Sun and our home. Two-thirds of Earth is covered in water, so from outer space it glows like a sapphire blue sphere. Earth has air with oxygen to breathe, water to drink, and an ideal temperature. That is why Earth is the only known planet teeming with life."
    },
    {
        "id": "ncert-c6-sci-ch7",
        "grade_level": 6,
        "subject": "Science",
        "book_name": "Science",
        "book_hindi_name": "विज्ञान",
        "chapter_number": 7,
        "title": "Motion and Measurement of Distances",
        "title_hindi": "गति एवं दूरियों का मापन",
        "description": "Evolution of transport, standard units of measurement (SI system), types of motion: rectilinear, circular, and periodic.",
        "core_concepts": [
            "History of transport from foot and bullock cart to steam and space travel",
            "Non-standard measurements (handspan, cubit, paces) and why standard units were needed",
            "The International System of Units (SI) — Meter for length",
            "Types of motion: Rectilinear (straight line), Circular (spinning wheel), Periodic (clock pendulum)"
        ],
        "learning_outcomes": [
            "Measures length accurately using standard metric units.",
            "Differentiates between rectilinear, circular, and periodic motions in daily phenomena."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?fesc1=7-11",
        "lesson_script": "Long ago, people measured distances using handspans and footsteps, but everyone's hands are different sizes! To make trade fair and accurate, scientists created standard units. Today, the meter is the universal SI unit of length. We also observe different kinds of motion. A car moving on a straight road is in rectilinear motion. A rotating ceiling fan moves in circular motion. And the swinging pendulum of a grandfather clock exhibits periodic motion, repeating its path at regular intervals."
    },

    # ==========================================
    # CLASS 7
    # ==========================================
    {
        "id": "ncert-c7-sci-ch1",
        "grade_level": 7,
        "subject": "Science",
        "book_name": "Science",
        "book_hindi_name": "विज्ञान",
        "chapter_number": 1,
        "title": "Nutrition in Plants",
        "title_hindi": "पादपों में पोषण",
        "description": "Autotrophic nutrition, process of photosynthesis, stomata, chlorophyll, insectivorous and parasitic plants.",
        "core_concepts": [
            "Autotrophic vs Heterotrophic nutrition",
            "Photosynthesis: Carbon dioxide + Water in sunlight with Chlorophyll yields Glucose + Oxygen",
            "Role of stomata in gas exchange and transpiration",
            "Parasitic plants (Cuscuta/Amarbel) and Insectivorous plants (Pitcher plant)",
            "Nutrient replenishment in soil by rhizobium bacteria and fertilizers"
        ],
        "learning_outcomes": [
            "Explains the biochemical equation and importance of photosynthesis.",
            "Describes specialized nutrition modes like parasitism and insect-trapping."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?gesc1=1-13",
        "lesson_script": "Green plants are the world's master cooks! Through a process called photosynthesis, plants take in carbon dioxide from the air through tiny leaf pores called stomata, draw water and minerals from soil through roots, and trap green sunlight energy using chlorophyll. They produce food in the form of glucose and release life-giving oxygen into the air. Some special plants like Cuscuta have no chlorophyll, so they climb on other trees as parasites. Pitcher plants trap insects to gain nitrogen in mineral-poor soils."
    },
    {
        "id": "ncert-c7-geo-ch1",
        "grade_level": 7,
        "subject": "Social Science (Geography)",
        "book_name": "Our Environment",
        "book_hindi_name": "हमारा पर्यावरण",
        "chapter_number": 1,
        "title": "Environment",
        "title_hindi": "पर्यावरण",
        "description": "Components of environment: natural (lithosphere, atmosphere, hydrosphere, biosphere) and human-made, ecosystems, and human impact.",
        "core_concepts": [
            "Definition of Environment (everything that surrounds living organisms)",
            "Four realms of the Earth: Lithosphere (rocky crust), Hydrosphere (water bodies), Atmosphere (air blanket), Biosphere (living zone)",
            "What constitutes an ecosystem",
            "Human interaction and need for sustainable balance"
        ],
        "learning_outcomes": [
            "Distinguishes between biotic and abiotic environmental components.",
            "Recognizes human interdependence on natural ecosystems."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?gess2=1-7",
        "lesson_script": "Environment means everything that surrounds us—the air we breathe, the water we drink, the ground we walk on, and the plants and animals we live with. The solid rocky crust is the lithosphere, the oceans and rivers form the hydrosphere, and the thin blanket of air is our atmosphere. Where land, water, and air meet to support life, we find the wonderful biosphere. All organisms interact with each other and their surroundings in ecosystems. Protecting our environment preserves life for tomorrow."
    },

    # ==========================================
    # CLASS 8
    # ==========================================
    {
        "id": "ncert-c8-sci-ch1",
        "grade_level": 8,
        "subject": "Science",
        "book_name": "Science",
        "book_hindi_name": "विज्ञान",
        "chapter_number": 1,
        "title": "Crop Production and Management",
        "title_hindi": "फसल उत्पादन एवं प्रबंध",
        "description": "Agricultural practices in India: soil preparation, sowing, manures & fertilizers, irrigation techniques, weed protection, harvesting, and grain storage.",
        "core_concepts": [
            "Kharif crops (monsoon: rice, maize) vs Rabi crops (winter: wheat, gram)",
            "Steps in agricultural cycle: Tilling, Sowing high-yield seeds, Adding manure",
            "Modern irrigation methods: Drip irrigation and Sprinkler systems to conserve water",
            "Weed removal (weeding) and organic pest management",
            "Proper grain drying and storage in silos to prevent fungal and pest damage"
        ],
        "learning_outcomes": [
            "Outlines the systematic agricultural sequence practiced by Indian farmers.",
            "Compares water-efficient modern irrigation techniques against traditional flooding."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?hesc1=1-13",
        "lesson_script": "India is an agricultural land that feeds over 1.4 billion people! Crops are categorized by season: Kharif crops like paddy and maize are sown during monsoon rains, while Rabi crops like wheat and mustard thrive in winter. Farmers follow careful scientific practices: ploughing the soil to let roots breathe, selecting clean disease-free seeds, adding organic manure, and using modern drip irrigation that delivers water drop-by-drop to the roots without waste. Harvesting and safe storage in aerated silos protects our nation's food security."
    },
    {
        "id": "ncert-c8-sci-ch2",
        "grade_level": 8,
        "subject": "Science",
        "book_name": "Science",
        "book_hindi_name": "विज्ञान",
        "chapter_number": 2,
        "title": "Microorganisms: Friend and Foe",
        "title_hindi": "सूक्ष्मजीव: मित्र एवं शत्रु",
        "description": "Bacteria, fungi, protozoa, algae, and viruses; beneficial uses in curd/bread/medicines/nitrogen fixation vs infectious diseases.",
        "core_concepts": [
            "Four major groups of microorganisms: Bacteria, Fungi, Protozoa, Algae",
            "Viruses: Microscopic entities that reproduce only inside host cells",
            "Beneficial microbes: Lactobacillus for curd, Yeast for fermentation, Antibiotics (Penicillin)",
            "Biological nitrogen fixation by Rhizobium in leguminous plant root nodules",
            "Harmful microbes causing diseases in humans, plants, and animals",
            "Food preservation: Salting, sugar syrup, oil, vinegar, and Pasteurization"
        ],
        "learning_outcomes": [
            "Classifies microorganisms into major families.",
            "Explains beneficial ecological and industrial roles of microbes.",
            "Applies scientific food preservation principles at home."
        ],
        "official_pdf_url": "https://ncert.nic.in/textbook.php?hesc1=2-13",
        "lesson_script": "All around us live billions of living organisms so tiny that we cannot see them with naked eyes. These are microorganisms! Some are helpful friends: Lactobacillus bacteria turn milk into delicious curd, yeast makes bread soft and spongy, and Alexander Fleming discovered Penicillin from Penicillium fungus to cure bacterial infections. Rhizobium bacteria in dal plant roots fix atmospheric nitrogen to enrich soil. But other microbes are foes that cause illnesses like malaria, typhoid, and tuberculosis. Washing hands and cooking food properly keeps harmful microbes away."
    }
]


def get_all_chapters() -> List[Dict[str, Any]]:
    """Return all curated NCERT chapters."""
    return NCERT_CURRICULUM


def get_chapters_by_grade(grade_level: int) -> List[Dict[str, Any]]:
    """Filter NCERT chapters by grade level (1 to 8)."""
    return [c for c in NCERT_CURRICULUM if c["grade_level"] == grade_level]


def get_chapters_by_subject(subject_query: str) -> List[Dict[str, Any]]:
    """Filter NCERT chapters by subject keyword (e.g. Science, Maths, EVS, Social)."""
    q = subject_query.lower()
    return [c for c in NCERT_CURRICULUM if q in c["subject"].lower()]


def get_chapter_by_id(chapter_id: str) -> Dict[str, Any]:
    """Retrieve specific chapter by unique ID."""
    for c in NCERT_CURRICULUM:
        if c["id"] == chapter_id:
            return c
    return None
