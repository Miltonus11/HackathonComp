"""Seed content for the pre-assessment. English only: validated Filipino versions are [VERIFY].

PHQ-9 and GAD-7 are free to use (Pfizer); WHO-5 is free to use with citation. [VERIFY] licensing notes.
All advice is seeded as PUBLISHED so the demo works, but it has NOT been clinically reviewed.
"""

SEED_REVIEWER = 'SEED - pending clinical review'

from .content import FREQ_4, WHO5_OPTIONS

INSTRUMENTS = {
    'WHO5': dict(
        name='WHO-5 Well-Being Index', min_response=0, max_response=5, score_direction='HIGHER_BETTER',
        recall_period_days=14, scoring_version='who5-1.0',
        source_citation='World Health Organization (1998). WHO-5 Well-Being Index. [VERIFY] thresholds and licence.',
        options=WHO5_OPTIONS,
        items=[
            'I have felt cheerful and in good spirits',
            'I have felt calm and relaxed',
            'I have felt active and vigorous',
            'I woke up feeling fresh and rested',
            'My daily life has been filled with things that interest me',
        ],
    ),
    'GAD7': dict(
        name='GAD-7 Generalized Anxiety Disorder scale', min_response=0, max_response=3,
        score_direction='HIGHER_WORSE', recall_period_days=14, scoring_version='gad7-1.0',
        source_citation='Spitzer RL, Kroenke K, Williams JBW, Lowe B (2006). Developed with Pfizer. [VERIFY] licence note.',
        options=FREQ_4,
        items=[
            'Feeling nervous, anxious, or on edge',
            'Not being able to stop or control worrying',
            'Worrying too much about different things',
            'Trouble relaxing',
            'Being so restless that it is hard to sit still',
            'Becoming easily annoyed or irritable',
            'Feeling afraid, as if something awful might happen',
        ],
    ),
    'PHQ9': dict(
        name='PHQ-9 Patient Health Questionnaire', min_response=0, max_response=3,
        score_direction='HIGHER_WORSE', recall_period_days=14, scoring_version='phq9-1.0',
        source_citation='Kroenke K, Spitzer RL, Williams JBW (2001). Developed with Pfizer. [VERIFY] licence note.',
        options=FREQ_4,
        items=[
            'Little interest or pleasure in doing things',
            'Feeling down, depressed, or hopeless',
            'Trouble falling or staying asleep, or sleeping too much',
            'Feeling tired or having little energy',
            'Poor appetite or overeating',
            'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
            'Trouble concentrating on things, such as reading or watching television',
            'Moving or speaking so slowly that other people could have noticed, or the opposite: being so '
            'fidgety or restless that you have been moving around a lot more than usual',
            'Thoughts that you would be better off dead, or of hurting yourself in some way',
        ],
        critical_items=[9],
    ),
}

# (min, max, severity_code, label, triggers_crisis_flow). PHQ-9/GAD-7 on raw; WHO-5 on scaled (0-100).
BANDS = {
    'PHQ9': [
        (0, 4, 'MINIMAL', 'Minimal', False),
        (5, 9, 'MILD', 'Mild', False),
        (10, 14, 'MODERATE', 'Moderate', False),
        (15, 19, 'MODERATELY_SEVERE', 'Moderately severe', False),
        (20, 27, 'SEVERE', 'Severe', True),
    ],
    'GAD7': [
        (0, 4, 'MINIMAL', 'Minimal', False),
        (5, 9, 'MILD', 'Mild', False),
        (10, 14, 'MODERATE', 'Moderate', False),
        (15, 21, 'SEVERE', 'Severe', True),
    ],
    'WHO5': [  # [VERIFY] thresholds against the official WHO-5 guide
        ('0.0', '28.0', 'LIKELY_DEPRESSION', 'Very low wellbeing', True),
        ('28.1', '51.9', 'POOR', 'Low wellbeing', False),
        ('52.0', '100.0', 'GOOD', 'Good wellbeing', False),
    ],
}

# (instrument, severity_code, suggested_action, headline, message)
ADVICE = [
    ('PHQ9', 'MINIMAL', 'MONITOR', 'Few signs of low mood',
     'Your responses suggest few or no signs of low mood right now. Keep up the habits that help you, and '
     'check in again in about two weeks.'),
    ('PHQ9', 'MILD', 'SELF_CARE', 'Some signs of low mood',
     'Your responses suggest mild signs of low mood. Small steps like regular sleep, movement and talking '
     'with someone you trust can help. Support is available if you want it.'),
    ('PHQ9', 'MODERATE', 'CONSIDER_PROFESSIONAL', 'Signs of moderate low mood',
     'Your responses suggest moderate signs of low mood. This is a screening result, not a conclusion about '
     'you. Talking to a health professional can help, and we can show you options near you.'),
    ('PHQ9', 'MODERATELY_SEVERE', 'PRIORITY_REFERRAL', 'Signs of significant low mood',
     'Your responses suggest significant signs of low mood. We strongly encourage you to talk to a health '
     'professional soon. We can show you services and help you reach them.'),
    ('PHQ9', 'SEVERE', 'PRIORITY_REFERRAL', 'Signs of severe low mood',
     'Your responses suggest severe signs of low mood. Please reach out to a health professional or someone '
     'you trust as soon as you can. You do not have to handle this alone.'),
    ('GAD7', 'MINIMAL', 'MONITOR', 'Few signs of anxiety',
     'Your responses suggest few or no signs of anxiety right now. Keep doing what helps you feel settled.'),
    ('GAD7', 'MILD', 'SELF_CARE', 'Some signs of anxiety',
     'Your responses suggest mild signs of anxiety. Slow breathing, a steady routine and limiting stress '
     'triggers can help. Support is available if you want it.'),
    ('GAD7', 'MODERATE', 'CONSIDER_PROFESSIONAL', 'Signs of moderate anxiety',
     'Your responses suggest moderate signs of anxiety. This is a screening result, not a conclusion about '
     'you. Talking to a health professional can help, and we can show you options near you.'),
    ('GAD7', 'SEVERE', 'PRIORITY_REFERRAL', 'Signs of severe anxiety',
     'Your responses suggest severe signs of anxiety. We strongly encourage you to talk to a health '
     'professional soon. We can show you services and help you reach them.'),
    ('WHO5', 'GOOD', 'MONITOR', 'Your wellbeing looks good',
     'Your responses suggest good wellbeing over the past two weeks. Keep up what works for you, and check '
     'in again in about two weeks.'),
    ('WHO5', 'POOR', 'SELF_CARE', 'Your wellbeing looks low',
     'Your responses suggest your wellbeing has been low over the past two weeks. We will ask a few more '
     'questions to understand how you are doing.'),
    ('WHO5', 'LIKELY_DEPRESSION', 'PRIORITY_REFERRAL', 'Your wellbeing looks very low',
     'Your responses suggest your wellbeing has been very low over the past two weeks. We strongly encourage '
     'you to talk to a health professional or someone you trust.'),
]

CRISIS_ADVICE = (
    'CRISIS', 'CRISIS_SUPPORT', 'You are not alone, and help is available',
    'Thank you for being honest. Your responses suggest you may be going through something very hard, and you '
    'deserve support right now. If you are in danger or thinking about hurting yourself, please call one of '
    'the numbers below or go to the nearest emergency room. You can also tell someone you trust, or tap '
    '"Talk to a person" to reach a trained responder.',
)
