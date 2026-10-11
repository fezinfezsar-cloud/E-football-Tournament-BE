module.exports = {
  techfestName: "VAST TECHFEST 2026",
  tournamentName: "MINI MAYHEM",
  eventDate: "October 15, 2026",
  eventTime: "09:00 AM IST",
  venue: "South Block, VAST",
  registrationFee: 30, // in INR
  currency: "₹",
  maxParticipants: 32,
  upiId: "techfest.efootball@upi",
  upiQrPlaceholder: "/assets/upi-qr-sample.png",
  contactPhone: "+91 9074268400",
  contactEmail: "tl24btec0127@vidyaacademy.ac.in",
  prizePool: "₹750",
  prizeDescription: "Total Cash Prize Pool of ₹750 with cash prizes for 1st and 2nd place winners.",
  prizeBreakdown: [
    { rank: "1st Place (Champion)", prize: "₹500 Cash Prize" },
    { rank: "2nd Place (Runner Up)", prize: "₹250 Cash Prize" }
  ],
  platform: "Mobile Only",
  gameVersion: "eFootball 2026 Mobile v3.4.0+",
  rules: {
    general: [
      "Tournament format is Knockout Stage followed by Best-of-3 Finals.",
      "Platform: Mobile Only. All matches must be played strictly on mobile devices (Android / iOS).",
      "Match duration: 10 minutes (5 mins per half). Extra time & Penalties ON for draw matches.",
      "Players must use their own personal registered eFootball mobile accounts.",
      "Reporting time: Participants must report 15 minutes before their scheduled match time at South Block, VAST.",
      "Fair Play: Any form of cheating, glitch exploitation, or unsportsmanlike behavior will lead to immediate disqualification."
    ],
    squad: [
      {
        title: "Rule 1 — Maximum Team Strength",
        text: "The total team strength must be less than or equal to 3200. Teams exceeding 3200 are not allowed.",
        badge: "Strength ≤ 3200"
      },
      {
        title: "Rule 2 — Standard Players",
        text: "Standard player cards are allowed, but their player rating must be strictly above 95. A rating of exactly 95 is not permitted.",
        badge: "Rating > 95"
      },
      {
        title: "Rule 3 — Fully Progressed Cards",
        text: "All player cards included in the Game Plan must be fully progressed.",
        badge: "100% Progression"
      },
      {
        title: "Rule 4 — Custom Progression",
        text: "Custom progression is allowed, but a player's rating must not decrease by more than 3 points compared with the applicable reference rating. A decrease of exactly 3 points is permitted.",
        badge: "Drop ≤ 3 Points"
      }
    ],
    match: [
      "Game Speed: Normal (Default)",
      "Condition: Excellent (Green arrow) or Random based on stage rules.",
      "Substitutions: Maximum 5 substitutions per match.",
      "Disconnections: If a match disconnects due to network issues within the first 15 mins (game time), match will be replayed. After 15 mins, remaining time will be played preserving score."
    ],
    conduct: [
      "No abusive language in match lobby or tournament area.",
      "No account sharing or impersonation.",
      "Decisions made by the Tournament Chief Marshal are final and binding."
    ],
    payment: [
      "Registration fee is non-refundable (₹30 per participant) unless tournament is cancelled by organizers.",
      "Valid payment screenshot with clear UTR/Transaction reference number is mandatory.",
      "Uploads with fake or reused payment screenshots will result in account ban."
    ]
  }
};
