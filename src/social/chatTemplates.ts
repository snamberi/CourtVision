import type { PersonalityType } from '../simulation/personality';

/*
 * CourtChat post templates. Each template is a line with alternatives in square brackets ("[a|b|c]", picked one at
 * random) and slots in braces, filled from the game:
 *   {pts} {reb} {ast}   the poster's line        {fg}      shooting, "4-for-17"
 *   {score}             "121-104"                 {opp}     the other team ("Lakers")
 *   {team}              the poster's team         {target}  the player being roasted (@handle)
 *   {mate}              a teammate (@handle)      {streak}  games in a row
 *   {games}             games out (injury)        {newTeam} / {oldTeam}  after a trade
 *   {award}             "MVP"                     {round}   "the second round"
 *   {pick}              draft pick number         {player}  a player's @handle (insiders, the GM)
 *   {gm}                the GM's @handle          {years}   seasons played
 * Every combination of alternatives is a different post: `variantCount()` counts them (well over 2,000).
 * The roasting is trash talk between pros: sharp, never cruel, nothing a kid can't read.
 */

export type ChatKind = 'bigNight' | 'win' | 'loss' | 'blowoutLoss' | 'badNight' | 'roast' | 'clapback' | 'hype' | 'winStreak' | 'loseStreak' | 'injury' | 'traded' | 'rivalry'
  | 'milestone' | 'seriesWin' | 'eliminated' | 'champion' | 'award' | 'rookie' | 'signed' | 'tradeRequest' | 'retired' | 'pregame'
  | 'fanWin' | 'fanLoss' | 'insiderInjury' | 'insiderRumor' | 'insiderRequest'
  | 'gmHype' | 'gmPraise' | 'gmCallout' | 'gmRival' | 'gmPraiseReply' | 'gmCalloutReply' | 'gmHypeReply' | 'gmRivalReply' | 'fanGmReply';
type P = PersonalityType;
export type Library = Record<ChatKind, Partial<Record<P | 'any', string[]>>>;

export const LIBRARY: Library = {
  bigNight: {
    any: [
      '[Mom, did you see that?|Dad, I hit the shot!|For the family:] [{pts} tonight.|{pts}-{reb}-{ast}.|{pts} and a W.] [Love you.|This one\'s for you.|Dinner on me.] [Long way from the park.|Dreams do come true.]',
      '[Hot hand alert.|Couldn\'t miss.|Rim was a swimming pool.] [{pts} on the {opp}.|{pts} points, {score} final.] [Saving the ball.|Signed game shoes for the kids.|Goodnight, everybody.]',
      '[{pts} points tonight.|Dropped {pts}.|{pts}-{reb}-{ast} on the {opp}.] [Felt good to get going.|Rim looked like an ocean.|Everything was falling.] [Thank you, God.|Shoutout {mate} for the screens.|Grateful.|Let\'s keep rolling.]',
      '[Not gonna lie,|Real talk,|Honestly,] [that was fun.|I felt it early.|the basket was huge tonight.] [{pts} and the W.|{score} final.|{pts}, {reb} boards.] [Sleep well, {opp}.|Good game, {opp}.|Tip your cap to the {opp}.]',
      '[Box score check:|Postgame receipt:|Final tally:] {pts} PTS, {reb} REB, {ast} AST. [Team win.|Big W.|Good night in {team}.] [Recovery day tomorrow.|Ice bath time.|Wings on the way.]',
    ],
    Leader: [
      '{pts} tonight, but [the bench|the whole squad|every single guy] made it happen. [Proud of this group.|That\'s {team} basketball.|We eat together.]',
      '[Big night|Good night at the office|Fun one]. {pts}-{reb}-{ast}, and [the young guys were locked in|the defense won it for us|nobody cared who scored]. [Back at it tomorrow.|Film at 9.|On to the next.]',
      '[Stat line looks nice|The numbers are cool], but [the W|the win|the {score} final] is the only stat I [post|care about|frame].',
    ],
    Hothead: [
      '{pts} on [their heads|them|anybody they sent]. [Next.|Who\'s next?|Send another defender.]',
      '[They said I couldn\'t shoot.|Somebody said I was in a slump.|Heard the talk all week.] {pts} points [says otherwise|later|and I\'m still mad].',
      '[I was cooking|Kitchen was open|Chef mode] tonight. {pts}. [Tell the {opp} to bring oven mitts.|{opp} still looking for me.|Somebody check on the {opp}.]',
    ],
    'Star Ego': [
      '{pts}. [Just another Tuesday.|Light work.|Didn\'t even break a sweat.|You\'re welcome, {team}.]',
      '[Put it in the museum.|Frame this one.|Highlight reel loading...] {pts}-{reb}-{ast}. [The league is mine.|Get used to it.|I don\'t miss.]',
      '[Hate to say I told you so.|Told y\'all.|Was there ever a doubt?] {pts} on the {opp}. [Main character energy.|Best player on the floor. Again.|They should charge extra to watch me.]',
    ],
    Mercenary: [
      '{pts} tonight. [My agent is smiling somewhere.|Contract year energy.|That\'s a max-contract stat line.] [Just saying.|Pay attention, GMs.|Numbers don\'t lie.]',
      '[{pts}-{reb}-{ast}.|{pts} points, {ast} assists.] [Somebody tell the front office.|Put it on my résumé.|Invoice coming soon.]',
    ],
    Competitor: [
      '{pts} doesn\'t matter if [we lose|we don\'t keep it going|we let up]. [Locked in.|Next game.|Back in the gym tonight.]',
      '[Good win.|Needed that one.|That\'s how you close.] {pts} and [a W|the win]. [Still left points out there.|Missed two free throws. Unacceptable.|Gym at 6 AM.]',
      '[I want every game like this.|Tonight was the standard.|That\'s the level.] {score}. [Nobody\'s satisfied.|We go again.|Hungry.]',
    ],
    Loyal: [
      '{pts} for the city of [{team}|my {team}]. [This place raised me.|Never leaving.|This jersey means everything.]',
      '[Love these fans.|The crowd tonight!|Hear that arena?] {pts}-{reb}-{ast} [for you all|is for {team} nation|because you never stopped believing].',
    ],
    Professional: [
      '{pts}, {reb} and {ast}. [Did my job.|Took what the defense gave.|Solid team win.] [On to the next.|Recover and repeat.|Good night, everyone.]',
      '[Good win|Nice team effort|Solid road win] against a [tough|good|well-coached] {opp} team. [Appreciate the support.|Shoutout to the trainers.|Sleep, then film.]',
    ],
  },
  win: {
    any: [
      '[Bus is quiet but happy.|Group chat is going crazy.|Locker room karaoke tonight.] [{score} over the {opp}.|Beat the {opp}.|Another one against the {opp}.] [{mate} picks the music.|{mate} owes everybody dinner.|{mate} says hi.] [Goodnight.|W.|Let\'s go!]',
      '[Home crowd was rocking.|Road crowd went home sad.|What an atmosphere.] [{score}.|W over the {opp}.] [Thank you for coming out.|We feed off that energy.|Best fans around.] [See you next game.|Bring the noise again.]',
      '[W.|Dub.|Another W.] [{score} over the {opp}.|Took care of the {opp}.|Handled business against the {opp}.] [Good vibes on the plane.|Locker room music is loud tonight.|Happy flight home.|Wings for everyone.]',
      '[Ball moved.|Defense showed up.|Bench was huge.] [{mate} was a problem tonight.|Shoutout {mate}.|{mate} did the dirty work.] [{score}.|W.] [Onto the next.|Love this group.|Keep stacking.]',
      '[Good team win against the {opp}.|Beat a good {opp} team.|{opp} made us work for it.] [{pts} from me,|Chipped in {pts},] [but it was a team thing.|but the defense won it.|but the bench closed it.]',
    ],
    Leader: [
      '[Team win.|Everybody ate.|That\'s winning basketball.] {score} over the {opp}. [Proud of {mate} tonight.|Shoutout {mate} for the energy.|{mate} was everywhere.]',
      '[Defense travels.|We did the little things.|Ball moved, we won.] [W.|Another one.|Stack them up.] [Let\'s keep building.|One game at a time.]',
    ],
    Hothead: [
      '[W. Talk to me now.|Where all the doubters at?|Thought we were washed?] {score}. [Keep that same energy, {opp}.|Bye, {opp}.|{opp} fans real quiet now.]',
      '[Refs tried it.|Even with those calls,|Whistle was crazy but] we still [won|got it done|took care of business]. {score}.',
    ],
    'Star Ego': [
      '[Another W because of me.|Easy when you have me.|I make winning look easy.] {score}. [Carry jobs are tiring.|My teammates should send me a thank-you card.|Light work for the GOAT.]',
      '[Did what I always do.|Won. Obviously.|Of course we won.] {pts} on the {opp}. [Next.|Too easy.|Can I get a challenge?]',
    ],
    Mercenary: [
      '[Winning pays.|Wins = bonuses.|Love a win bonus.] {score} over the {opp}. [Keep them coming.|Bag secured.|Cha-ching.]',
      '[W.|Good win.] [{pts} points|{pts} and {ast} dimes] [on the stat sheet|for the highlight reel]. [Agents, take notes.|Market value: rising.]',
    ],
    Competitor: [
      '[One down.|That\'s one.|Good.] [Not satisfied.|Back to work.|Still hungry.] {score} over the {opp}, [but we can be better|but the fourth quarter was sloppy|and I want the next one more].',
      '[We came to compete.|Every possession mattered.|Fought for 48 minutes.] [W.|Earned it.|Deserved it.] [Film session tomorrow.|No days off.]',
    ],
    Loyal: [
      '[Home sweet home.|Love this team.|Proud to wear this jersey.] {score} over the {opp}. [{team} forever.|Thank you, {team} fans.|This is home.]',
      '[Another win with my brothers.|Same guys, same goal.|Built different here.] [Proud of {mate}.|{mate} played his heart out.]',
    ],
    Professional: [
      '[Good team win.|Solid effort.|Nice win tonight.] {score}. [Recover and get ready for the next one.|Credit to the {opp}, they played hard.|Thanks to everyone who came out.]',
      '[Took care of business|Did our job|Executed the game plan] [tonight|on the road|at home]. [On to the next.|Long season.]',
    ],
  },
  loss: {
    any: [
      '[Team dinner is quiet tonight.|Long night.|Bad taste in my mouth.] [{opp} {score}.|Lost to the {opp}.|Dropped one to the {opp}.] [Doesn\'t define us.|Long season.|Not panicking.] [Back to work.|We\'ll see.]',
      '[Missed shots we usually make.|Turnovers killed us.|Got outrebounded.] [Fixable stuff.|We\'ll clean it up.|Coach will have words.] [Next game we answer.|Can\'t wait to play again.]',
      '[L.|Tough one.|Not our night.] [{score}.|{opp} got us.|Credit the {opp}.] [We\'ll see them again.|Bounce-back game next.|Short memory.|Back to the drawing board.]',
      '[Hate this feeling.|That one stings.|Long flight home.] [{pts} from me wasn\'t enough.|Couldn\'t close it out.|Fourth quarter got away.] [We\'ll be fine.|On to the next.|Learn from it.]',
      '[Shoutout to the {opp},|Gotta tip the cap to the {opp},|Respect the {opp},] [they made shots.|they played harder tonight.|they deserved that one.] [We\'ll be ready next time.|Rematch is circled.]',
    ],
    Leader: [
      '[That one\'s on me.|Put this loss on me.|I\'ll take that one.] [We\'ll be better.|Back to work tomorrow.|We learn and move on.] [Love this group.|Stay together.]',
      '[Tough night.|Not our best.|We\'ll learn from that.] {opp} [played well|deserved it|made the plays]. [Heads up, fellas.|We bounce back.]',
    ],
    Hothead: [
      '[I\'m not even gonna talk about the refs.|Those calls though...|Who was reffing tonight?] [Unreal.|Anyway.|We move.] {score}.',
      '[I\'m so mad right now.|Can\'t sleep after that.|Not okay with this.] {opp} [got lucky|won\'t be so lucky next time|better enjoy it].',
    ],
    'Star Ego': [
      '[I did my part.|{pts} and we still lost?|Can\'t do everything myself.] [Somebody else gotta step up.|I need help out here.|Just saying.]',
      '[Not my fault.|Check my stats.|Blame the bench.] {score}. [Moving on.|My numbers were fine.]',
    ],
    Mercenary: [
      '[Losses don\'t pay.|Not great for the market.|Bad for business.] {score}. [Still got my {pts} though.|Numbers still look good.|At least my stat line was clean.]',
    ],
    Competitor: [
      '[I hate losing.|Losing makes me sick.|Can\'t stand this feeling.] {score}. [Back in the gym tonight.|Not happening again.|Remember this.]',
      '[No excuses.|We got outworked.|They wanted it more.] [That changes next game.|Never again.|Remember how this feels.]',
    ],
    Loyal: [
      '[Sorry, {team} fans.|We owe you one, {team}.|Rough night for the home team.] [We\'ll get the next one.|Still love this city.|We\'re not done.]',
    ],
    Professional: [
      '[Tough loss.|Credit to the {opp}.|Not our night.] [Watch the film, fix it, move on.|Long season. We\'ll be fine.|We learn and keep going.]',
      '[They hit shots.|Wasn\'t meant to be.|We had our chances.] {score}. [Next one.|Back to work.]',
    ],
  },
  blowoutLoss: {
    any: [
      '[{score}.|Rough night.|Ouch.] [Throw that film in the trash.|We\'ll pretend that didn\'t happen.|Nobody watch the highlights.] [Back at it tomorrow.|Practice is going to be long.|Lesson learned.]',
      '[That was not it.|We were not ready.|Bad night for all of us.] [{opp} punched first and kept punching.|The {opp} wanted it more.] [Never again.|Wake-up call.|We\'ll remember this.]',
    ],
    Leader: [
      '[Lost by a lot tonight.|That was ugly.|We got embarrassed tonight.] [Team meeting tomorrow.|That\'s not who we are.|Everybody look in the mirror, me first.]',
    ],
    Hothead: [
      '[Nobody talk to me.|Phone off.|Leave me alone tonight.] {score}. [I\'m going to the gym.|Unacceptable.|We\'ll see them again.]',
      '[{score}?|That was a blowout?] [Run it back. Right now.|I want a rematch tomorrow.|They\'re lucky I fouled out early.]',
    ],
    'Star Ego': [
      '[Was I even playing?|Only me trying out there.|Ball never found me.] {score}. [Tell the coach to call my number.|Give me the ball.|Next time, run it through me.]',
    ],
    Mercenary: [
      '[That one hurt the brand.|Not a good look for anyone\'s contract.|Agents saw that.] [Delete the film.|Let\'s forget that game.]',
    ],
    Competitor: [
      '[{score}. Embarrassing.|That was embarrassing.|I\'m furious.] [Gym. Now.|Nobody sleeps tonight.|We fix this.]',
      '[We didn\'t compete.|Didn\'t show up.|We quit tonight and that\'s on all of us.] [Never again.|That changes tomorrow.]',
    ],
    Loyal: [
      '[{team} fans, you deserve better than that.|We let the city down.|Sorry, {team}.] [We\'ll make it right.|Love you all.]',
    ],
    Professional: [
      '[Rough one.|Not our night at all.|Credit to the {opp}.] [Throw this film away.|Turn the page.|Next.]',
    ],
  },
  badNight: {
    any: [
      '[I\'ll be honest,|Not gonna lie,] [I stunk tonight.|that was my worst game this year.|I owe my teammates one.] [{fg}.|Ice bath, film, back.] [Next game, I\'m cooking.|Bounce-back loading.]',
      '[Rough shooting night.|{fg}. Yikes.|Shot it like I had oven mitts on.] [Back in the gym.|Short memory.|The shots will fall.] [Next game.|Tomorrow is a new day.|Can\'t wait for the next one.]',
      '[My jumper went on vacation.|I left my shot at home.|Basket shrank tonight.] [{fg} from the field.|Couldn\'t find the bottom of the net.] [It\'s coming back.|I\'ll find it.|Team got me covered.]',
    ],
    Leader: [
      '[{fg} from the field. That\'s on me.|Couldn\'t buy a bucket.|Rim was not my friend.] [I\'ll be better.|Extra shots tomorrow.|Team carried me tonight.]',
    ],
    Hothead: [
      '[{fg}?|Rim had a lid on it.|Basket was crooked.] [I demand a recount.|Not my night. Next game is.|Somebody fix that hoop.]',
    ],
    'Star Ego': [
      '[Even legends have off nights.|{fg}, whatever.|Shooters shoot.] [I\'ll drop 40 next game.|Remember the other 81.|Still the best player out there.]',
    ],
    Mercenary: [
      '[{fg} won\'t be on the highlight reel.|Hope nobody from free agency watched that.|That line won\'t help the next contract.]',
    ],
    Competitor: [
      '[{fg}. Unacceptable.|That shooting was trash.|Embarrassing night from me.] [500 shots before I sleep.|Gym lights are on.|Fixing it tonight.]',
    ],
    Loyal: [
      '[Sorry, {team}.|Off night, {team}.] [{fg} isn\'t me.|I\'ll make it up to you.]',
    ],
    Professional: [
      '[Shots didn\'t fall.|Off shooting night.|{fg}. It happens.] [Stay with it.|Same shots tomorrow.]',
    ],
  },
  roast: {
    any: [
      '[Dear {target},|Note to {target}:|PSA for {target}:] [the hoop is the orange thing.|defense is allowed.|we\'re on the same court, you can guard me.] [{fg} tonight.|Scoreboard says {score}.] [Love you, mean it.|Kidding. Mostly.]',
      '[{target} gonna need a new highlight reel after tonight.|Somebody make {target} a highlight reel, he needs one.|{target} had a whole fan section and went {fg}.] [Not personal.|It\'s just basketball.|Good game though.]',
      '[Shoutout to {target} for the|Thank you {target} for the|Appreciate {target} for the] [free buckets|easy night|open lanes] [tonight.|all game.] [{fg}, my guy.|We should do this again.|Same time next month?]',
      '[{target} played defense like|{target} guarded me like|{target} closed out like] [a traffic cone|a revolving door|he was on vacation|a mannequin in a store window]. [All love.|Just joking. Mostly.|Good game though.]',
      '[Breaking news:|Update:|Fun fact:] {target} [went {fg} tonight.|forgot the ball goes in the hoop.|is still looking for his jump shot.] [Search party forming.|Prayers up.|We\'ll send it back by mail.]',
    ],
    Leader: [
      '[Respect to {target}, but|Love you {target}, but|No shade {target}, but] [{fg} ain\'t it.|you might want to hit the gym this week.|we\'ll be here if you want a rematch.]',
    ],
    Hothead: [
      '{target} [went {fg}|was talking all week and went {fg}]. [Quiet now.|Sit down.|Keep my name out your mouth.|Next time bring a jump shot.]',
      '[Somebody check on {target}.|Is {target} okay?|Did {target} even play tonight?] [I was in his head all game.|Locked up.|Nothing easy.]',
      '{target}, [that\'s {fg}.|you shot {fg} on my watch.] [Easiest night of my life.|I\'m sending you a rebounding machine for Christmas.|Do you want some lessons?]',
    ],
    'Star Ego': [
      '[Imagine guarding me.|Couldn\'t be {target} tonight.|Poor {target}.] [{pts} on his head.|He\'ll see me in his dreams.|Somebody get him a tissue.]',
      '{target} [said he was the best scorer on the floor.|thought he was on my level.] [{fg} says no.|Cute.|Not tonight, not ever.]',
    ],
    Mercenary: [
      '[{target} going {fg} is costing him money.|Hope {target}\'s agent wasn\'t watching.|{target} just dropped his price tag.] [Business is business.|Market correction.]',
    ],
    Competitor: [
      '[Guarded {target} all night.|My matchup tonight: {target}.] {fg}. [That\'s defense.|Locked in from the tip.|Get used to it.]',
      '[{target} was talking.|{target} wanted that matchup.] [Hope it was worth it.|Scoreboard.|{score}.]',
    ],
    Loyal: [
      '[{target} came into OUR building|{target} talked about our city] [and went {fg}.|and left with an L.] [Not in {team}.|This is our house.]',
    ],
    Professional: [
      '[Good battle with {target} tonight.|Tough matchup with {target}.] [{fg} isn\'t his usual.|He\'ll be back.] [Respect.|Always fun.]',
    ],
  },
  clapback: {
    any: [
      '[Screenshots don\'t lie, {target}.|Bold, {target}.|Big words, {target}.] [Our next game is on TV.|I\'ll see you in the playoffs.|Save this tweet.] [Then we talk.|Bring snacks.]',
      '[Funny, {target}.|Okay {target}, okay.|Cute post, {target}.] [Remember last season?|One game doesn\'t make you good.|Check the series record.] [See you soon.|Rematch loading.|I\'ll be waiting.]',
      '[{target} talking like|Look at {target} acting like] [he won a ring.|he\'s an All-Star.|he invented basketball.] [It was ONE game.|Relax.|We\'ll see.]',
    ],
    Leader: [
      '[Appreciate the love, {target}.|Ha, okay {target}.] [See you in the rematch.|We\'ll talk after the next one.|Good game.]',
    ],
    Hothead: [
      '[Relax, {target}.|Who asked you, {target}?|Bold talk from {target}.] [You\'re 0-for-forever against me.|Check our head-to-head.|Next game, you\'re mine.]',
      '{target} [got one good night|got lucky once] and [thinks he\'s a legend|started tweeting]. [Calm down.|We play again soon.|Screenshot this.]',
    ],
    'Star Ego': [
      '{target}, [you\'re not on my level.|who are you again?|I have more rings in my dreams than you have points.] [Next game, 50.|Keep my name trending.|Thanks for the clout.]',
    ],
    Mercenary: [
      '[Check my contract, {target}.|Bank account says I\'m fine, {target}.|{target} talking like he gets paid more than me.] [Bye.|Stay mad.]',
    ],
    Competitor: [
      '[Noted, {target}.|Screenshotted, {target}.|Saved this one, {target}.] [See you next time.|Bulletin board material.|Motivation.]',
    ],
    Loyal: [
      '[{target}, you can\'t talk about my city like that.|{target}, respect the {team}.] [We\'ll see you soon.|Our house next time.]',
    ],
    Professional: [
      '[Good game, {target}.|Fair, {target}.|Respect, {target}.] [Next time.|Long season.]',
    ],
  },
  hype: {
    any: [
      '[Can we get {target} more shots?|Everyone go follow {target}.|{target} for MVP?] [I\'m serious.|Not joking.|Just saying.] [What a game.|Unreal night.]',
      '[Feed {target}.|Give {target} the ball.|Run everything through {target}.] [He\'s unstoppable.|That\'s all I\'m saying.|Nobody can guard him.] [We go as he goes.|Proud of you, bro.]',
      '[Practice squad got cooked by {target} all week.|We knew {target} was ready.|Told y\'all about {target}.] [Now the league knows.|Tonight proved it.|And he\'s just getting started.]',
      '[{target} WENT OFF.|{target} is HIM.|Somebody stop {target}.|{target} said no mercy.] [Proud of you, bro.|Couldn\'t guard him in practice either.|Tell your friends.|Unreal.]',
      '[Best seat in the house watching {target} tonight.|{target} cooking again.|Get {target} in the All-Star game.] [Love to see it.|Keep going!|Too cold.]',
    ],
    Hothead: ['[{target} put them in a blender.|{target} said cook them.] [LET\'S GO.|They can\'t guard us.]'],
    'Star Ego': ['[Nice game, {target}.|{target} played well.] [Learned from the best.|Second-best player on the team tonight.]'],
    Leader: ['[That\'s my guy {target}.|{target} put in the work.] [Saw it coming in practice.|Earned every point.]'],
  },
  winStreak: {
    any: [
      '[{streak} straight wins.|Streak is at {streak}.|That\'s {streak} in a row.] [Vibes are immaculate.|Locker room is fun right now.|Plane rides are loud.] [Don\'t get comfortable.|Keep it going.|Lock in for the next one.]',
      '[Nobody\'s beaten us in {streak} games.|{streak}-game heater.] [Who\'s next on the schedule?|Bring on the next one.|Stay humble.]',
    ],
    Leader: ['[{streak} straight.|Won {streak} in a row.] [Stay humble, stay hungry.|Nobody relaxes.|Next one is the biggest one.]'],
    Hothead: ['[{streak} in a row.|{streak} straight Ws.] [Who wants it next?|Line them up.|Come get some.]'],
    'Star Ego': ['[{streak} straight wins.|{streak} in a row, of course.] [I told you I carry.|Wonder who the common factor is.|That\'s what happens when I\'m on the floor.]'],
    Mercenary: ['[{streak}-game win streak.|{streak} in a row.] [Win bonuses stacking up.|Streak pays.]'],
    Competitor: ['[{streak} straight.|{streak} in a row.] [Means nothing in June.|Not satisfied.|Keep going.]'],
    Loyal: ['[{streak} in a row for {team}!|{team} won {streak} straight!] [This city deserves it.|Best fans in the league.]'],
    Professional: ['[{streak} straight.|Nice run, {streak} in a row.] [Stay the course.|One at a time.]'],
  },
  loseStreak: {
    any: [
      '[Lost {streak} straight.|{streak}-game skid.|{streak} in a row. Ugh.] [Rock bottom builds character.|Only way is up.|Nobody\'s coming to save us.] [Let\'s go get one.|One win changes everything.|Stick together.]',
      '[Not gonna sugarcoat it,|Real talk,] [{streak} straight losses is not okay.|we\'ve lost {streak} in a row.] [It starts with me.|Time to flip it.|Tomorrow we fight.]',
    ],
    Leader: ['[{streak} straight losses.|{streak} in a row.] [Players-only meeting today.|We stick together.|It turns around now.]'],
    Hothead: ['[{streak} straight losses?|Lost {streak} in a row.] [Something has to change.|I\'m losing my mind.|Not acceptable.]'],
    'Star Ego': ['[{streak} in a row and I\'m the only one showing up.|{streak} straight. Not on me.] [Need help.|Call me when we get a roster.]'],
    Mercenary: ['[{streak}-game skid.|{streak} straight losses.] [Keeping my options open.|Bad market for us right now.]'],
    Competitor: ['[{streak} in a row.|{streak} straight Ls.] [I can\'t sleep.|Gym until it stops.|This ends tonight.]'],
    Loyal: ['[{streak} straight. Sorry, {team}.|We\'ll turn it around, {team}.] [Not giving up on this team.|Still believe.]'],
    Professional: ['[Rough stretch.|{streak} in a row.] [Keep working.|Stay the course.|It\'ll turn.]'],
  },
  injury: {
    any: [
      '[Update: out about {games} games.|Small setback: {games} games.|Gonna be out {games} games.] [Thanks for the messages.|Appreciate all the love.|Rehab mode.] [Back soon.|See you on the court.|Comeback season.]',
      '[Body said slow down.|Tweaked something.|Not the news I wanted.] [{games} games on the sidelines.|Sitting out {games}.] [Hold it down, {team}.|Be back stronger.|Cheering loud from the bench.]',
    ],
    Leader: ['[Out {games} games.|Gonna miss {games} games.] [Hold it down, fellas.|I\'ll be on the bench yelling.|Be back stronger.]'],
    Hothead: ['[{games} games out?|Injured. {games} games.] [This is so frustrating.|I hate watching from the bench.|Back soon and angrier.]'],
    'Star Ego': ['[The league gets {games} games off from me.|{games} games without me. Good luck, {team}.] [Enjoy the break, defenders.|Comeback tour loading.]'],
    Mercenary: ['[{games} games out.|Missing {games}.] [Body is the business.|Protecting the asset.]'],
    Competitor: ['[Out {games}.|{games} games.] [Rehab starts now.|I\'ll be back early.|Not going to sit still.]'],
    Loyal: ['[Sorry {team}, out for {games}.|{games} games out.] [Cheering from the bench.|Back for you soon.]'],
    Professional: ['[Out {games} games.|Small setback, {games} games.] [Trust the medical staff.|Rehab and back.]'],
  },
  traded: {
    any: [
      '[New city.|New jersey.|New chapter.] [{newTeam}, let\'s work.|Happy to be in {newTeam}.|Ready to go, {newTeam}.] [Forever grateful to {oldTeam}.|Thank you {oldTeam} for everything.|Love to {oldTeam} fans.]',
      '[Bags packed.|On a plane to {newTeam}.|Just landed in {newTeam}.] [Didn\'t see that coming.|Life moves fast.|Let\'s get it.] [{oldTeam}, it was real.|See you soon, {oldTeam}.]',
    ],
    Leader: ['[Thank you, {oldTeam}.|Love you forever, {oldTeam}.] [New chapter in {newTeam}.|Ready to lead in {newTeam}.|Let\'s get to work, {newTeam}.]'],
    Hothead: ['[{oldTeam} really traded me?|Okay, {oldTeam}.] [See you twice a year.|Circle the date.|{newTeam}, let\'s go.]'],
    'Star Ego': ['[{newTeam} just got a lot better.|{newTeam}, you\'re welcome.] [{oldTeam} will regret this.|Main character, new city.]'],
    Mercenary: ['[New team, new bag.|{newTeam} gets it.] [Business is business, {oldTeam}.|Pay me.]'],
    Competitor: ['[{newTeam}, I came to win.|Here to win, {newTeam}.] [{oldTeam}: thanks for everything. Now I\'m coming for you.|Let\'s get a ring.]'],
    Loyal: ['[Heartbroken to leave {oldTeam}.|{oldTeam} will always be home.] [I\'ll give {newTeam} everything.|Thank you for everything.]'],
    Professional: ['[Thank you {oldTeam}.|Grateful for my time in {oldTeam}.] [Excited for {newTeam}.|Ready to work.]'],
  },
  rivalry: {
    any: [
      '[Rivalry week, done.|Another chapter vs the {opp}.|{opp} game always hits different.] [{score}.|Got the W.] [Loudest crowd of the year.|That\'s why you play the game.|Tell your friends.]',
      '[The {opp} talked all week.|Heard the {opp} were confident.] [Scoreboard: {score}.|We let the game talk.] [See you next time.|Rivalry\'s alive.]',
    ],
    Leader: ['[Rivalry night.|Big one against the {opp}.] [We handled it.|That\'s how you win a rivalry game.|Proud of the fight.] {score}.'],
    Hothead: ['[I don\'t like the {opp}.|Never liked the {opp}.|{opp} week is my favorite week.] [{score}. See you next time.|Beat them again.|They know who runs this.]'],
    'Star Ego': ['[The {opp} can\'t guard me.|{opp} rivalry? What rivalry?] [{pts}.|Owned.|They\'re my favorite customers.]'],
    Mercenary: ['[Rivalry games sell tickets.|Big TV game against the {opp}.] [Showed out.|Primetime.]'],
    Competitor: ['[Circled this one on the calendar.|Been waiting for the {opp}.] [{score}.|Won the war.|Not done with them.]'],
    Loyal: ['[{team} vs {opp}.|Our house, our rivalry.] [{team} always.|The {opp} will never be us.]'],
    Professional: ['[Always a battle with the {opp}.|Good rivalry game.] [{score}.|Respect to them.]'],
  },

  // ---------------------------------------------------------------- big moments
  milestone: {
    any: [
      '[{pts} POINTS.|I just scored {pts}.|{pts}-{reb}-{ast}. Write it down.] [Never done that before.|Career night.|Pinch me.] [For everybody who believed.|Ball goes in the trophy case.|I\'ll remember this forever.]',
      '[Did that really happen?|Still shaking.|Can\'t sleep.] [{pts} against the {opp}.|{pts} points tonight.] [Thank you to my teammates.|The basket was the size of a pool.|God is good.]',
    ],
    'Star Ego': ['[{pts}. Historic.|{pts}. Make it a holiday.] [Write my name in the record book.|Somebody call the Hall of Fame.|Just me being me.]'],
    Leader: ['[{pts} tonight, but look at the assists we had as a team.|{pts}, and I\'m proudest of the defense.] [This group is special.|Love these guys.]'],
    Hothead: ['[{pts} on the {opp}.|{pts}. Somebody tell the {opp}.] [I warned them.|Should have double-teamed me.|That\'s what happens.]'],
  },
  seriesWin: {
    any: [
      '[Series over.|Onto the next round.|Moving on.] [Beat the {opp} in {round}.|{opp}, good series.] [Not done yet.|Four more.|We want more.]',
      '[Advance.|Next round, let\'s go!|Survive and advance.] [Credit to the {opp}.|{opp} pushed us.] [Long way to go.|Sleep, then work.]',
    ],
    Hothead: ['[Bye, {opp}.|Send the {opp} home.] [Who\'s next?|Next victim.|Book their vacation.]'],
    'Star Ego': ['[Carried us out of {round}.|Another series, another win for me.] [Next.|Too easy.]'],
    Competitor: ['[One round down.|Good. Not satisfied.] [Still three to go.|Back to the gym.]'],
  },
  eliminated: {
    any: [
      '[Season\'s over.|That\'s it for this year.|It hurts.] [{opp} were better.|Lost to the {opp} in {round}.] [We\'ll be back.|Summer of work starts now.|Thank you, {team} fans.]',
      '[Tough way to end it.|Not the ending we wanted.] [Proud of this group anyway.|Learned a lot this year.] [Next year.|See you in the fall.]',
    ],
    Hothead: ['[Can\'t believe it.|So mad right now.] [{opp} better enjoy it.|Next year they\'re mine.]'],
    Loyal: ['[Sorry, {team}.|We let you down, {team}.] [Not leaving. We\'ll get it done here.|This city deserves a title.]'],
  },
  champion: {
    any: [
      '[CHAMPIONS!|WE DID IT!|RINGS!] [{team} on top of the world.|Best team in the league.|Nobody can take this away.] [Parade time!|Love every one of you.|Tears everywhere.]',
      '[Dreamed about this as a kid.|Since I was six years old.|Every summer, every 6 AM workout.] [Champion.|For this.|Worth it.] [Thank you, {team}.|Let\'s celebrate.]',
    ],
    'Star Ego': ['[Told you.|Ring #1 of many.|The best player on the best team.] [Bow down.|Put it on my finger.]'],
    Leader: ['[Every single guy on this roster.|This is what team looks like.] [Champions.|Proud doesn\'t cover it.]'],
    Mercenary: ['[Ring and a bonus.|Title bonus hits different.] [Champions.|Worth every penny.]'],
  },
  award: {
    any: [
      '[{award}!|Just won {award}.|Honored to be the {award}.] [Thank you to my teammates.|Couldn\'t do it without the coaches.|Family, this is for you.] [Back to work.|Next goal: the ring.|Grateful.]',
      '[Wow. {award}.|Never thought I\'d say "{award}".] [Big thanks to {team}.|Shoutout everyone who voted.] [Let\'s keep going.|Hungry for more.]',
    ],
    'Star Ego': ['[{award}. Obviously.|{award}. Was there any doubt?] [Should have been unanimous.|Next year too.]'],
  },
  rookie: {
    any: [
      '[Dream come true.|Pinch me.|It\'s real.] [Drafted by {team}!|{team}, I\'m coming!] [Mom, we made it.|Can\'t wait to get to work.|Day one starts now.]',
      '[Rookie season starts now.|Ready, {team}.] [Work hard, stay humble.|Gonna carry the vets\' bags with a smile.] [Let\'s go!|Grateful.]',
    ],
    'Star Ego': ['[Rookie of the Year starts now.|Draft class MVP checking in.] [{team} got the steal.|Remember the teams that passed.]'],
  },
  signed: {
    any: [
      '[New team, who dis?|Signed with {newTeam}!|Officially part of {newTeam}.] [Grateful for the opportunity.|Let\'s get to work.|Can\'t wait to meet the fans.] [New chapter.|Here we go.]',
    ],
    Mercenary: ['[Signed. Bag secured.|{newTeam} paid up.] [Business is business.|Grateful for the money... I mean, the opportunity.]'],
    Loyal: ['[Proud to call {newTeam} home.|{newTeam}, I\'m here for the long run.] [Let\'s build something.|Loyalty starts today.]'],
  },
  tradeRequest: {
    any: [
      '[Time for a change.|Sometimes you need a new start.|Thinking about my future.] [...|No comment.|We\'ll see.]',
      '[Grateful for everything here, but|Love the fans, but] [it\'s time.|I need something new.] [...]',
    ],
    Hothead: ['[I\'m done.|Get me out of here.|Enough is enough.] [...|You heard me.]'],
    Mercenary: ['[Contract talks? Let\'s just say I\'m listening.|My phone is on.] [Agent has the details.|Open to offers.]'],
  },
  retired: {
    any: [
      '[After {years} seasons,|{years} years.|What a ride.] [I\'m hanging them up.|It\'s time to say goodbye.] [Thank you, basketball.|Thank you, {team}.|Forever grateful.]',
      '[Last game is in the books.|The shoes are retired.] [{years} seasons I\'ll never forget.|Every teammate, every coach: thank you.] [See you on the other side.|Time for the next chapter.]',
    ],
  },
  pregame: {
    any: [
      '[{opp} tomorrow.|Rivalry week.|Big one next.] [Been waiting for this.|Circle it.|You know what time it is.] [See you soon.|Bring it.]',
    ],
    Hothead: ['[{opp}, I hope you\'re ready.|Got the {opp} next. Good.] [Last time was a warning.|Somebody hide their best player.|Bring snacks, it\'s gonna be a show.]'],
    'Star Ego': ['[{opp} game tomorrow.|Next up: the {opp}.] [They know what\'s coming.|50 loading.|Easy night.]'],
    Competitor: ['[{opp} next.|Locked in for the {opp}.] [Film all night.|This one matters.]'],
  },

  // ---------------------------------------------------------------- fans and the insider
  fanWin: {
    any: [
      '[WHAT A GAME!|LET\'S GOOOO!|{team} WIN!] [{score} over the {opp}!|Beat the {opp}!] [Best team in the league!|Playoffs here we come!|I love this team!]',
      '[Section 112 was rocking!|Still hoarse from yelling.|My voice is gone.] [{team} {score}.|W!] [Worth every penny of my ticket.|See you next game!]',
      '[{player} for MVP.|Give {player} a statue.|{player} is HIM.] [{pts} tonight!|What a night!]',
    ],
  },
  fanLoss: {
    any: [
      '[Not again.|Why do I do this to myself.|My poor heart.] [{score} to the {opp}.|Lost to the {opp}.] [Trade everyone.|Fire somebody.|Still love you though.]',
      '[I\'m not mad.|I\'m fine. Totally fine.|Who needs sleep anyway.] [{team} lost.|{opp} again?] [Next game we bounce back.|Same time next game.]',
      '[GM, please make a trade.|Somebody call the front office.|{gm}, we need help.] [This roster needs work.|Bench is empty.]',
    ],
  },
  insiderInjury: {
    any: [
      '[Sources:|Injury update:|Per team sources,] {player} [will miss about {games} games|is out roughly {games} games] [with a {award} injury.|({award}).] [More soon.|Developing.]',
    ],
  },
  insiderRumor: {
    any: [
      '[Sources:|Hearing that|Per league sources,] [{team} are shopping {player}.|teams are calling {team} about {player}.|{player} is on the trade block in {team}.] [Developing.|More to come.|Deadline is getting interesting.]',
    ],
  },
  insiderRequest: {
    any: [
      '[BREAKING:|Sources:|Per league sources,] {player} [has asked {team} for a trade.|wants out of {team}.] [Developing.|Expect calls.|Front office is listening.]',
    ],
  },

  // ---------------------------------------------------------------- the GM and the reactions
  gmHype: {
    any: [
      '[Proud of this group.|Big things coming.|This team is special.] [{team} basketball is back.|Let\'s fill the arena!|We\'re just getting started.] [See you at the next game!|Bring the noise!]',
      '[Love the effort lately.|The work is showing.] [Keep stacking wins.|Every night, together.] [Go {team}!]',
    ],
  },
  gmPraise: {
    any: [
      '[Shoutout to {player}.|Huge credit to {player}.|Can\'t say enough about {player}.] [Doing everything for this team.|A true pro.|Worth every dollar.] [Proud of you.|Keep going.]',
    ],
  },
  gmCallout: {
    any: [
      '[{player}, we need more.|Expecting more from {player}.|{player}, it\'s time to step up.] [Every night counts.|We believe in you, so show it.|The standard is higher.]',
    ],
  },
  gmRival: {
    any: [
      '[See you soon, {opp}.|Hey {opp}, we\'re coming.|{opp}: circle the date.] [Our building, our rules.|Bring your best.|It\'s our turn.]',
    ],
  },
  gmPraiseReply: {
    Leader: ['[Appreciate you, {gm}.|Thanks {gm}.] [It\'s all about the team though.|The whole group earned it.]'],
    Hothead: ['[Finally some respect.|About time, {gm}.] [Let\'s keep it rolling.|Watch what I do next.]'],
    'Star Ego': ['[Glad you noticed, {gm}.|Just stating facts, {gm}.] [Put it on a billboard.|Contract talks soon?]'],
    Mercenary: ['[Kind words, {gm}.|Thanks {gm}.] [Kind words are nice. Extensions are nicer.|Let\'s talk numbers.]'],
    Competitor: ['[Thanks {gm}.|Appreciate it.] [Not satisfied yet.|Still a lot left to prove.]'],
    Loyal: ['[Love you, {gm}!|Means a lot, {gm}.] [Never leaving {team}.|This is home.]'],
    Professional: ['[Thank you, {gm}.|Appreciate it, {gm}.] [Just doing my job.|Back to work.]'],
  },
  gmCalloutReply: {
    Leader: ['[Fair, {gm}.|Heard you, {gm}.] [That\'s on me. I\'ll be better.|I\'ll lead by example.]'],
    Hothead: ['[Really, {gm}? On here?|Wow {gm}. In public?] [Could have texted me.|We\'ll talk in your office.|Watch me prove you wrong.]'],
    'Star Ego': ['[Delete this, {gm}.|Bold of you, {gm}.] [Check my stats.|Remember who sells the tickets.]'],
    Mercenary: ['[Noted, {gm}.|Okay {gm}.] [My agent saw that.|Keep that in mind at contract time.]'],
    Competitor: ['[Say less, {gm}.|Message received, {gm}.] [Watch the next game.|Motivation.]'],
    Loyal: ['[That hurts, {gm}.|Didn\'t expect that from you, {gm}.] [I\'ll show you I belong here.|Still love this team.]'],
    Professional: ['[Fair point, {gm}.|Understood, {gm}.] [I\'ll keep working.|Better days coming.]'],
  },
  gmHypeReply: {
    any: [
      '[Let\'s gooo!|We hear you, {gm}!|That\'s right!] [{team} up!|Together.|Big things.]',
      '[Ready.|Locked in.|Can\'t wait.] [Next game is a statement.|Fill it up!]',
    ],
  },
  gmRivalReply: {
    any: [
      '[Cute, {gm}.|Bold words from the front office.|{gm} talking big.] [Tell your team to show up first.|See you on the floor.|We\'ll be waiting.]',
    ],
    Hothead: ['[{gm}, who are you?|Front office trash talk now?] [Your players are next.|I\'ll make it personal.]'],
  },
  fanGmReply: {
    any: [
      '[YES GM!|Love this GM.|Best GM in the league.] [Make it happen!|Let\'s go!|Season tickets renewed!]',
      '[Less posting, more trading.|Big talk, GM.|Prove it, GM.] [We want wins.|Fix the bench first.]',
      '[Ratioed.|L post.|W post.] [Haha.|No comment.]',
    ],
  },
};

/* ---- expansion and counting ---- */

const GROUP = /\[([^\]]+)\]/g;

/** How many different posts one template can make. */
export const templateVariants = (t: string) => [...t.matchAll(GROUP)].reduce((n, m) => n * m[1].split('|').length, 1);

/** Every template in the library. */
export const allTemplates = (): string[] => Object.values(LIBRARY).flatMap(byP => Object.values(byP).flat());

/** Different posts the whole library can write (before names and numbers are filled in). */
export const variantCount = () => allTemplates().reduce((n, t) => n + templateVariants(t), 0);

/** Every expansion of one template (for tests). */
export function expandAll(t: string): string[] {
  const m = GROUP.exec(t); GROUP.lastIndex = 0;
  if (!m) return [t];
  return m[1].split('|').flatMap(opt => expandAll(t.slice(0, m.index) + opt + t.slice(m.index + m[0].length)));
}

/** One expansion, choosing each alternative with `rand`. */
export const expand = (t: string, rand: () => number) => t.replace(GROUP, (_, opts: string) => { const o = opts.split('|'); return o[Math.floor(rand() * o.length) % o.length]; });

export const fill = (t: string, vars: Record<string, string | number | undefined>) => t.replace(/\{(\w+)\}/g, (all, k: string) => (vars[k] == null ? all : String(vars[k])));

/** The templates a poster of this personality can use for this kind of post (theirs, then the shared ones). */
export function templatesFor(kind: ChatKind, type: P): string[] {
  const byP = LIBRARY[kind];
  const own = byP[type] ?? [];
  const any = byP.any ?? [];
  return own.length ? [...own, ...any] : any.length ? any : byP.Professional ?? [];
}
