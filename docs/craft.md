# Craft notes: how stories work, and how to get good long fiction from a language model

## What this document is for

Storyteller has a language model write an original novel one chapter at a time while you read it. The pipeline goes world, then cast, then plot plan, then each chapter drafted and summarised into a knowledge graph. Along the way the reader can steer the story, branch it or ask for a sequel. This document collects what working writers, editors and researchers say makes long fiction good. It is the background for the prompts and checks the plugin uses.

Two ground rules shape it:

- **Craft, not imitation.** Storyteller never borrows characters, places, plots or inventions from existing books, and it never imitates a named author's voice. Writers and editors appear below as *sources of craft knowledge*: how a scene works, why a payoff lands. They are never style models. Nothing here says "write like X".
- **Say how strong the evidence is.** Craft advice is mostly the experience of practitioners, and it conflicts in places. The research on language-model fiction is young, often small-scale, and often scored by other language models. Each section says which kind of evidence it rests on.

Every section ends with practical takeaways: what a writer, human or machine, actually does differently.

---

## 1. Story structure models, and when each fits

Structure models are diagnostic tools, not recipes. Brandon Sanderson, who teaches the creative-writing course at Brigham Young University, says in his [2025 lecture on story structure](https://www.brandonsanderson.com/blogs/blog/brandon-sandersons-2025-overview-of-story-structure-lecture-3) that a structure is "something that you can hang your story on". His advice is to use frameworks mostly in revision, to find out why something isn't working.

**Three-act structure.** Setup, confrontation, resolution, with turning points between them. Its value is that by the end of the first act a central dramatic question is clear, and the climax answers it (Sanderson, same lecture). It fits nearly any plot-driven novel. It says little about what happens *inside* the long second act, which is where the next two models help.

**The try-fail cycle (yes-but / no-and).** A character attempts something and the result complicates matters. "Yes, but": they succeed, but something else goes wrong. "No, and": they fail, and things get worse. The Writing Excuses hosts (Sanderson, Mary Robinette Kowal, Dan Wells, Howard Tayler) treat this as the engine of a story's middle in [episode 10.29](https://writingexcuses.com/writing-excuses-10-29-why-should-my-characters-fail-spectacularly/). They warn against turning it into a checklist ("always three cycles"), advise planning cycles back from the ending, and want each cycle to do more than one job. Jim Butcher's widely cited [LiveJournal craft posts](https://m.livejournal.com/read/user/jimbutcher/1262) add a harsher outcome, "No, and furthermore...", to be saved for critical points.

**Scene and sequel (goal, conflict, disaster / reaction, dilemma, decision).** Dwight V. Swain, *Techniques of the Selling Writer* (University of Oklahoma Press, 1965; [catalogue entry](https://www.abebooks.com/9780806111919/Techniques-Selling-Writer-Swain-Dwight-0806111917/plp)), defines a scene as a unit of conflict: a character pursues a **goal**, meets **conflict**, and ends in a **disaster** that blocks the goal. A sequel is a unit of transition: **reaction** (emotion), **dilemma** (the bad options), **decision**, and the decision becomes the next scene's goal. Jack M. Bickham's *Scene & Structure* (Writer's Digest Books, 1993; [listing](https://www.goodreads.com/book/show/190209)) develops the same model. It fits chapter-by-chapter generation well, because every unit has a clear purpose and a clear handoff.

**The MICE quotient.** Orson Scott Card introduced it in *How to Write Science Fiction and Fantasy* (Writer's Digest Books, 1990; [listing](https://goodreads.com/book/show/31363.How_to_Write_Science_Fiction___Fantasy)). Kowal later renamed "Idea" to "Inquiry" and taught it at length on Writing Excuses ([16.35, "What is the M.I.C.E. Quotient?"](https://writingexcuses.com/16-35-what-is-the-m-i-c-e-quotient/); also [6.10](https://writingexcuses.com/writing-excuses-6-10-scott-cards-m-i-c-e-quotient/)). Each story thread is one of four kinds, and its kind tells you where it starts and ends:

- **Milieu.** Opens when a character enters a place; closes when they leave or settle there.
- **Inquiry.** Opens with a question; closes when it is answered.
- **Character.** Opens with dissatisfaction with who one is; closes when the character changes or accepts themselves.
- **Event.** Opens when the status quo is disrupted; closes when a new order is established.

Threads **nest**: the first opened should be the last closed, like brackets. Kowal's practical use is diagnostic. An ending feels wrong when it closes a different kind of thread from the one the opening promised.

**Kishōtenketsu.** A four-part form from Chinese poetry, later used in Japanese, Korean and Vietnamese writing and in four-panel comics: *ki* (introduction), *shō* (development), *ten* (a twist or unexpected juxtaposition), *ketsu* (reconciliation of the parts) ([Wikipedia overview](https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu)). It became known in English-language writing circles largely through a [2012 essay on the Still Eating Oranges blog](https://www.downes.ca/post/58577/rd) arguing that plot does not require conflict. The fair critique, which the Wikipedia article records, is that "without conflict" oversimplifies: the form *doesn't centre* conflict, but many works built on it contain plenty. Henry Lien's *Spring, Summer, Asteroid, Bird* (W. W. Norton) is the main recent craft book on East Asian structures. Kishōtenketsu suits quiet chapters, slice-of-life sequences and short interludes where meaning comes from juxtaposition rather than opposition.

**The hero's-journey family, treated critically.** Joseph Campbell's monomyth was condensed for screenwriters by Christopher Vogler in a 1985 Disney memo ([reproduced here](https://ilacp.memberclicks.net/vogler-7-page-memo)) and later in *The Writer's Journey*. Vogler himself warned that "following the guidelines of myth too rigidly can lead to a stiff, unnatural structure", and that the stages can be deleted, added to and re-shuffled. Folklorists' criticisms are summarised in [Wikipedia's article](https://en.wikipedia.org/wiki/Hero%27s_journey): the pattern was cherry-picked from stories that fit it, its categories are too vague to falsify, it centres a male journey, and it carries ideological baggage. Sanderson says he prefers Dan Harmon's simpler "story circle" adaptation to the full monomyth, which he finds too rigid (lecture 3, above). Use it as a vocabulary for transformation stories. Don't use it as a mandatory sequence.

**Takeaways**
- Choose the structure per thread: three acts for the overall arc, try-fail cycles for the middle, scene and sequel inside chapters, MICE to check that openings and endings match.
- Record each thread's MICE type in the plan and close threads in reverse order of opening.
- Allow occasional chapters that work by juxtaposition (kishōtenketsu) rather than opposition.
- Treat hero's-journey stages as optional vocabulary, never a checklist.

## 2. Promises, progress, payoff: what an opening commits a book to

Sanderson's [2025 plot lecture](https://brandonsanderson.com/blogs/blog/brandon-sandersons-2025-guide-to-plot-lecture-2) organises plot around three things:

- **Promises.** What the opening tells the reader about tone, genre, the central conflict, and the kind of change the protagonist will go through. A funny opening promises a funny book, and a brutal one promises danger.
- **Progress.** The reader's sense of moving toward the payoff. It can come through information (clues found, suspects eliminated), relationships, or a character's changing beliefs. Sanderson notes that "a big reason that people drop off a book is that there weren't enough signposts of progress". He suggests treating a chapter's first paragraph as a quiet thesis statement that tells the reader where this chapter is headed.
- **Payoff.** "A surprising but fulfilling answer to your promise." Payoffs should feel earned, and Sanderson warns that the point of a twist "isn't to trick the reader".

**Takeaways**
- In the plan, write down the promises the first chapter makes about tone, the central question and the protagonist's change, and check every later chapter against them.
- Give each chapter at least one visible step of progress on some promise.
- Each subplot needs its own promise, progress and payoff.
- When the reader steers or branches the story, re-state which promises still stand, and resolve or deliberately retire the ones that don't.

## 3. Character: want and need, the lie, arc types, agency, motive

K. M. Weiland's character-arc model is the most widely used in genre writing. She sets it out in *Creating Character Arcs* (2016; [listing](https://www.goodreads.com/book/show/32825587)) and in a [free series on her site](https://www.helpingwritersbecomeauthors.com/character-arcs-2/). Its parts:

- **The lie.** A false belief the character holds about themselves or the world. It is fine on the outside and rotting on the inside.
- **The want.** The external goal the character pursues, often driven by the lie ([part 3: want vs need](https://www.helpingwritersbecomeauthors.com/character-arcs-3/)).
- **The need.** The truth that would correct the lie. If the character can get what they want and what they need without tension between the two, the story has no arc.
- **The ghost.** The past wound that explains why the character believes the lie ([part 4](https://www.helpingwritersbecomeauthors.com/character-arcs-4/)).

Weiland distinguishes three arc types. In a **positive change** arc the character gives up the lie for the truth. In a **flat** or "testing" arc the character already holds the truth, has doubts, and changes the world around them ([flat arc series](https://www.helpingwritersbecomeauthors.com/flat-character-arc-1/)). In a **negative** arc the character refuses the truth and ends worse. John Truby's *The Anatomy of Story* (2007; [listing](https://www.goodreads.com/book/show/5216342)) frames the same idea as **weakness and need** (psychological and moral) against **desire** (the outward goal).

**Agency and motive.** The scene-and-sequel model above builds agency in, because every scene begins with a goal the character chose. Writing Excuses repeatedly stresses that characters must make choices that cause the next problem, and that the worst plausible decision for *this* character is often the right next beat ([18.46](https://writingexcuses.com/18-46-nanowrimo-week-3-raising-the-stakes/)). Lisa Cron's *Wired for Story* (Ten Speed Press, 2012; [Poets & Writers listing](https://www.pw.org/node/885963)) argues that readers follow a character's internal struggle more than the external events. Treat its brain-science framing as popular rather than rigorous; the craft point stands on its own.

**Takeaways**
- For every point-of-view character, record the want, the need, the lie, the ghost and the arc type in the cast sheet.
- In each chapter, have the character's choices, not coincidence, drive the turn.
- Make want and need pull in different directions, and decide which one wins at the climax.
- Supporting characters need their own wants, or they become props.

## 4. Stakes and escalation

Writing Excuses [episode 18.46](https://writingexcuses.com/18-46-nanowrimo-week-3-raising-the-stakes/) (Kowal, DongWon Song, Erin Roberts, Dan Wells) makes three points. Stakes feel high when they are **personal** rather than large, so a threatened keepsake can matter more than a threatened city. You have to **establish what the character values before you threaten it**. And escalation comes from try-fail cycles, from layering two ways to fail on one action, and from pushing characters toward their worst plausible choice. Donald Maass, a literary agent, distinguishes **personal stakes** (what the protagonist could lose) from **public stakes** (what the wider world could lose) in *Writing the Breakout Novel* (2001; [listing](https://bookshop.org/ib/TheMixed-UpFiles/9781582971827)), and argues the strongest books tie the two together. Robert McKee's *Story* (1997) locates story energy in the "gap" between what a character expects when they act and what actually happens; Emily Short gives a [useful summary for interactive writers](https://emshort.blog/2019/02/05/story-robert-mckee/). Sanderson warns that stakes must rise gradually: going from zero to saving the world in three chapters "won't feel earned" (lecture 3).

**Takeaways**
- Show what the character loves before putting it at risk.
- Escalate along the personal axis first and the public axis second, and link them.
- Each try-fail cycle should leave the situation measurably worse or more complicated.
- Even quiet or cosy stories need something to lose; only the scale changes.

## 5. Foreshadowing and fair twists

**Setup and payoff.** The principle known as "Chekhov's gun" comes from several remarks of Anton Chekhov. In a letter of 1 November 1889 to A. S. Lazarev (Gruzinsky) he wrote that one must not put a loaded rifle on the stage if no one means to fire it. Other versions survive only in later recollections ([sources collected here](https://en.wikipedia.org/wiki/Chekhov%27s_gun)). The counter-argument, which the same article records, is that if every detail does exactly one job the story becomes predictable. Texture and the occasional red herring are allowed.

**Fair play.** Golden Age mystery writers turned fairness into explicit rules. S. S. Van Dine's ["Twenty Rules for Writing Detective Stories"](https://www.umsl.edu/~gradyf/film/vandinerules.htm) (*The American Magazine*, 1928) opens with "The reader must have equal opportunity with the detective for solving the mystery." Ronald Knox's "Decalogue" ([background](https://en.wikipedia.org/wiki/Ronald_Knox)) followed in 1929. Treat both lists as historical documents: many items are period taste, and Knox's list includes a racist rule. The lasting principle is that every clue the solution needs must be on the page before the reveal. Caroline Crampton's [Shedunnit episode on "The Rules"](https://shedunnitshow.com/therulestranscript) gives the modern view. The rules were never strictly followed, and celebrated books broke them. What lasted was the Detection Club's ideal of "playing fair by the reader".

**Misdirection that survives rereading.** Sanderson's definition of payoff, surprising but fulfilling, is the test. On a second reading the twist should look inevitable, because the clues were present and honestly described. They were only framed so that the reader read them another way.

**Takeaways**
- Record every planted clue and setup in the knowledge graph, together with its intended payoff chapter.
- Before a reveal, check that the reader has already seen everything the solution needs.
- Misdirect by emphasis and framing, never by false narration (unless an unreliable narrator was set up from the start).
- Let some details simply be texture; not every object must fire.

## 6. Magic and world systems

**Sanderson's laws.** The [First Law](https://brandonsanderson.com/sandersons-first-law/): "An author's ability to solve conflict with magic is DIRECTLY PROPORTIONAL to how well the reader understands said magic." The essay is also where "hard" magic (explicit rules, usable to solve problems) and "soft" magic (wonder and atmosphere, which rarely solves problems and often creates them) became common terms. The Second Law is **limitations are more interesting than powers**: costs and limits create story. The Third Law is **expand what you already have before you add something new**. Both are summarised on his [FAQ page](https://faq.brandonsanderson.com/knowledge-base/what-are-sandersons-laws-of-magic/) and in his [2025 lecture notes](https://www.brandonsanderson.com/blogs/blog/guide-to-sandersons-laws-of-magic-lecture-notes). Sanderson calls these guidelines that have worked for him, not universal laws.

**Iceberg worldbuilding and its critics.** Hemingway's "iceberg" principle (*Death in the Afternoon*, 1932) says that what the writer knows and leaves out still gives the visible part its weight. On the sceptical side, M. John Harrison called obsessive worldbuilding "the great clomping foot of nerdism" in a 2007 blog post ([quoted by the BSFA's Vector](https://vector-bsfa.com/2007/01/28/thought-for-the-day/)). His point is that the world exists to serve the writing, not the other way round.

**Infodumps and invented terms.** Jo Walton coined the term [**incluing**](https://reactormag.com/sf-reading-protocols/): "scattering pieces of information seamlessly through the text", which the reader assembles into a picture of the world. She contrasts it with the plain infodump. Writing Excuses [episode 4.26](https://writingexcuses.com/writing-excuses-4-26-avoiding-stilted-dialog/) has an exercise that rewrites an infodump scene as an argument that carries the same information. Le Guin's 1973 essay ["From Elfland to Poughkeepsie"](https://en.wikipedia.org/wiki/From_Elfland_to_Poughkeepsie) argues that the language of an invented world has to feel like it belongs there and not like modern office prose with the names changed.

**Takeaways**
- Decide for each system whether it is hard or soft. Only hard elements, explained on the page beforehand, may resolve a climax.
- Write down each system's costs and limits before its powers.
- Develop existing elements before inventing new ones.
- Introduce invented terms one at a time, in a context that makes their meaning clear, and reuse them consistently. Keep a glossary in the knowledge graph.
- Prefer incluing to exposition. When exposition is needed, put it in a scene where someone wants something from it.

## 7. Point of view, voice and tense

Le Guin's *Steering the Craft* (revised edition 2015; [Kirkus review](https://kirkusreviews.com/book-reviews/ursula-k-le-guin/steering-the-craft/print)) gives a chapter to "Point of View and Voice" and another to "Changing Point of View". She distinguishes first person, limited third, the involved (omniscient) author, the detached author, and the observer-narrator, and she sets exercises in each. Her central practical warning is about uncontrolled head-hopping. Changing the viewpoint is fine; doing it without noticing is not. John Gardner's *The Art of Fiction* (1983) describes **psychic distance**, a scale from a distant, camera-like statement of fact down to sentences that sit inside a character's head. It is summarised by the [University of Nevada, Reno writing centre](https://www.unr.edu/writing-speaking-center/student-resources/writing-speaking-resources/psychic-distance-in-creative-writing). Unmotivated jumps along that scale read as amateurish.

Tense is a choice to make once and keep. "Tense inconsistency" is one of the seven kinds of flaw that professional writers fixed most often in model-written prose (Chakrabarty et al., section 13).

**Takeaways**
- Fix each chapter's viewpoint character, person, tense and default psychic distance in the plan.
- Within a scene, change viewpoint only at a marked break.
- Let the viewpoint character's knowledge limit what the narration can know.
- Vary distance on purpose: wide for transitions, close for emotional peaks.

## 8. Dialogue

The Writing Excuses dialogue episodes ([18.28, conversational dialogue](https://writingexcuses.com/18-28-writing-conversational-dialogue/); [10.38, context](https://writingexcuses.com/?p=4985)) describe written dialogue as compressed speech, with the small talk removed, working on three layers: text, subtext and context. Each line should have a reason the character says it. Elmore Leonard's "Easy on the Adverbs, Exclamation Points and Especially Hooptedoodle" (*New York Times*, 16 July 2001; [reprinted rules](https://csmonitor.com/Books/2008/0115/p16s01-bogn.html)) gives the best-known mechanical rules: carry dialogue with "said", and don't add an adverb to "said". Renni Browne and Dave King's *Self-Editing for Fiction Writers* (2nd ed., 2004; [publisher page](https://www.harpercollins.ca/9780060545697/self-editing-for-fiction-writers-second-edition/)), written by two professional editors, covers dialogue mechanics and action "beats" in place of tags.

**Takeaways**
- Give each speaker a goal in the conversation, and let characters talk past each other.
- Leave the important thing unsaid where you can (subtext).
- Use plain tags ("said", "asked") or action beats, and drop the adverbs.
- Never use dialogue to tell characters things they already know ("as you know...").
- Each named character's speech should differ from the others' (vocabulary, rhythm, what they avoid saying).

## 9. Pacing and chapter endings

Writing Excuses [21.30, "Chapter Breaks Soon"](https://writingexcuses.com/21-30-chapter-breaks-soon/) (Kowal, Song, Roberts, Tayler) treats chapters mainly as a pacing tool. Readers often stop at chapter ends, so a chapter that ends at a natural resting point with no reason to continue makes the book easy to put down. The hosts list several kinds of ending: the open-question or "reaction shot" ending, the episodic chapter that is complete in itself but ends on a hook, and the "promise of more". They also warn that **constant cliffhangers become monotonous**. K. M. Weiland adds that a cliffhanger is no substitute for something actually happening ([chapter cliffhangers](https://www.helpingwritersbecomeauthors.com/chapter-cliffhangers/)). Writing Excuses [10.32](https://writingexcuses.com/writing-excuses-10-32-how-do-i-control-the-speed-of-the-story/) covers controlling speed through scene length, summary against dramatised scene, and where breaks fall.

**Takeaways**
- Vary chapter endings: open question, decision made, revelation, quiet emotional beat, sudden reversal. Avoid the same type twice in a row.
- Don't end on a moral, a summary of what the chapter meant, or the character falling asleep.
- Use chapter length as a lever: short chapters speed things up, long ones let a reader settle in.
- A cliffhanger must be resolved honestly in the next chapter, not undone.

## 10. Subplots and theme

Sanderson's lectures say each side plot needs its own promise, progress and payoff, and that try-fail cycles can open subplots and show the world (lecture 3). MICE gives the mechanics: a subplot is another thread with its own type, and it has to be closed in nesting order. Writing Excuses advises that complications stay tied to the central story to avoid "plot bloat" ([10.29](https://writingexcuses.com/writing-excuses-10-29-why-should-my-characters-fail-spectacularly/)). Truby treats theme as the moral argument the story makes through the protagonist's choices, not a message stated outright. The research on language-model fiction (section 13) independently finds that models "over-explain themes" (Russell et al., StoryScope), which is exactly the failure these craft writers warn against.

**Takeaways**
- Each subplot should mirror, contrast or put pressure on the main arc. If it does none of these, cut it.
- Let theme come out of choices and their consequences. Never have a character or narrator state the lesson.
- Track open subplots in the knowledge graph, and give each a planned resolution chapter.

## 11. Serial and episodic fiction

Storyteller is a serial: the reader reads while the book is being written, as with Victorian part-issues and modern web serials.

**Dickens' practice.** Most of Dickens' major novels came out in twenty monthly parts (the last a double number) of three or four chapters each. From *Dombey and Son* (1846) onward he kept working notes, a sheet per number, with chapter titles, key events and long-range plans on the left-hand side. The [Digital Dickens Notes Project](https://dickensnotes.org/introduction/general) finds that he used them as much for retroactive bookkeeping as for planning. He tested names, questioned plot details and summarised what he had already published, often writing close to the deadline. The [Victorian Web](https://victorianweb.org/victorian/authors/dickens/parts.html) has more on the part-issue format. The serial maxim "make 'em laugh, make 'em cry, make 'em wait" is variously attributed to Wilkie Collins, Charles Reade or Dickens, and its source is unverified.

**Modern serial practice.** Writing Excuses [15.23, "Serialization"](https://writingexcuses.com/15-23-serialization/), with television producer Jenn Court, argues that "emotion should always be driving a serialized story, not plot". Chasing ever-bigger plot events produces less satisfying instalments. The episode suggests planning arcs at series, season and episode level, and separates *episodic* stories, where each instalment resolves a problem, from *serial* ones, which carry long arcs. Web-serial writers' rules of thumb (consistency of schedule, of instalment length, and of quality) circulate widely in community guides. I found no primary source for them worth citing, so treat them as folklore that matches common sense.

**Takeaways**
- Keep a "number plan" in the Dickens manner: what each chapter must do, and a running record of what it actually did. The knowledge-graph summary is that record.
- Each instalment should give the reader an emotional experience as well as advance the plot.
- When a reader returns after a gap, recap through the story: a character remembering, or a conversation that re-establishes the situation. Avoid a block of "previously".
- Keep continuity facts (names, injuries, objects, who knows what) in the graph, and check every new chapter against it.
- Keep instalment length and quality steady so readers know what they are getting.

## 12. Revision: what editors check

Editors work in levels, broadest first. Jane Friedman, a publishing-industry writer, [explains the distinctions](https://www.janefriedman.com/the-differences-between-line-editing-copy-editing-and-proofreading). A **developmental** (structural) edit looks at story, organisation, character arcs, pacing and point of view. A **line** edit works on sentences and paragraphs: clarity, rhythm, word choice, voice. A **copy** edit covers correctness and consistency. **Proofreading** is the final check for errors. The order matters, because fixing sentences in a chapter that will be cut wastes effort. Writing Excuses [5.29, "Rewriting"](https://writingexcuses.com/writing-excuses-5-29-rewriting/) describes a working writer's version of this sequence:

1. a triage pass (what is broken, what to add, what to cut);
2. a read-through for general problems;
3. a character-by-character pass for voice and consistency;
4. other readers.

The writers in that episode also let the draft "cool" between passes. Browne and King's *Self-Editing for Fiction Writers* is organised as editors' checklists: show versus tell, characterisation and exposition, point of view, dialogue mechanics, beats, interior monologue, and proportion.

**A short developmental checklist, synthesised from these sources**
- Does the opening make clear promises, and does the ending keep them?
- Does each chapter have a goal, an obstacle and a turn? Does something change?
- Do the protagonist's choices cause the turns?
- Are stakes established before they are threatened, and do they rise?
- Is viewpoint controlled, with consistent tense and distance?
- Are all setups paid off, and every needed clue planted before its reveal?
- Do the threads close in nesting order? Are any subplots orphaned?
- Is there exposition a scene could carry instead?

**Takeaways**
- Revise structure before sentences.
- Run separate, narrowly focused passes rather than one "make it better" pass.
- Use a fresh reader, or a fresh context, for critique, because the author can't see the gap between what they intended and what is on the page.

## 13. Getting good long fiction from language models: what the research shows

The research is young. Most studies use short stories (under about 5,000 words), small human evaluations, and often a language model as judge. None I found evaluates novel-length coherence with human readers. The summaries below include sample sizes where the papers give them.

### Planning before drafting, hierarchical outlining

- **Fan, Lewis and Dauphin 2018**, [Hierarchical Neural Story Generation](https://aclanthology.org/P18-1082/) (ACL). Generates a premise first, then the story, trained on about 300,000 prompt-story pairs from an online forum. Human judges preferred it about 2:1 over a non-hierarchical baseline. These were pre-GPT-era models and short stories.
- **Yao et al. 2019**, [Plan-and-Write](https://arxiv.org/abs/1811.05701) (AAAI). Plans a storyline of keywords before writing. Reports more diverse, coherent, on-topic stories by automatic and human measures. The stories are only five sentences long.
- **Yang et al. 2022**, [Re3](https://arxiv.org/abs/2210.06774) (EMNLP). Builds a structured plan, drafts by repeatedly reprompting with plan and story-state context, then reranks and edits. Over 100 premises, with three Mechanical Turk workers judging each story pair, it gained 14 points (absolute) in coherent plot and 20 in premise relevance over the same base model. The stories were about 2,000 to 2,500 words. The authors say their own edit module did *not* improve the main metrics, and that evaluation difficulty limited their sample sizes.
- **Yang et al. 2023**, [DOC](https://aclanthology.org/2023.acl-long.190) (ACL). A more detailed hierarchical outline plus a controller that keeps drafting faithful to it. In human evaluation of stories several thousand words long, it beat Re3 by 22.5 points on plot coherence, 28.2 on outline relevance and 20.7 on interestingness, and judges found it more controllable interactively.
- **Mirowski et al. 2023**, [Dramatron](https://arxiv.org/abs/2209.14958) (CHI). Hierarchical prompt chaining from logline to characters, beats, locations and dialogue. The evaluation was qualitative: 15 theatre and film professionals co-wrote with it and were interviewed. It is useful for what professionals want from a co-writing tool (control, editability) but gives no quantitative quality claim.
- **Huot et al. 2025**, [Agents' Room](https://arxiv.org/abs/2410.02603) (ICLR). Planning agents (plot, character, setting, conflict) and per-section writing agents share a scratchpad under an orchestrator. Its Tell Me A Story dataset has only 55 test prompts, with stories of roughly 1,000 to 3,000 words. Raters were writers or had literature degrees. Agreement between raters was moderate (Fleiss' κ = 0.46). An LLM judge (Gemini 1.5 Pro) correlated with humans at ρ = 0.62 per system but only ρ = 0.41 per item.
- **Bai et al. 2024**, [LongWriter](https://arxiv.org/abs/2408.07055) (ICLR 2025). Argues that the typical 2,000-word output ceiling comes from short fine-tuning data. A plan-then-write-sections agent (AgentWrite) produces 10,000+ word outputs. Quality was scored by GPT-4o as judge on 120 prompts, and the authors note this may be unfair where GPT-4o judges its own outputs. This is evidence about *length*, not literary quality.
- **Tian et al. 2024**, [Are LLMs Capable of Generating Human-Level Narratives?](https://aclanthology.org/2024.emnlp-main.978) (EMNLP). Compared 1,638 human and GPT-4 movie synopses using expert and automatic annotation. Model stories were "homogeneously positive" and lacked suspense and tension, and human stories varied more in structure. Prompting with explicit discourse features (story arcs, turning points) improved diversity, suspense and arousal by over 40%.

**Verdict.** Planning before drafting is the best-supported practice. It holds across many systems and research groups. The effect sizes, though, come from short stories, small human samples and older models. That it scales to a novel is a plausible extrapolation, not a demonstrated result.

### Critique, then revise

- **Madaan et al. 2023**, [Self-Refine](https://arxiv.org/abs/2303.17651) (NeurIPS). One model drafts, critiques its draft and revises in a loop. About 20 points average absolute improvement over one-shot generation, judged by humans and automatic metrics, across 7 tasks. None of the tasks was long fiction.
- **Huang et al. 2024**, [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798) (ICLR). Without external feedback, self-correction did not reliably help and sometimes hurt. This was a reasoning study, but it is a caution against assuming that self-critique always helps.
- **Chakrabarty, Laban and Wu 2025**, [Can AI writing be salvaged?](https://arxiv.org/abs/2409.14509) (CHI 2025). Eighteen professional writers, mostly MFA-trained, edited 1,057 model-written creative paragraphs (8,035 edits). In preference tests the order was writer-edited, then LLM-edited, then raw LLM. So automatic editing helps, but less than expert editing. Model detectors of the flaws reached a precision of 0.46, against 0.57 agreement between experts. The three model families tested did not differ meaningfully in writing quality.
- **Bae and Kim 2024**, [CritiCS](https://arxiv.org/abs/2410.02428) (EMNLP). Several LLM critics with different personas, plus a leader, refine first the plan and then the text. The authors report human-judged gains in creativity and engagement, with coherence maintained. The abstract gives little evaluation detail.

**Verdict.** There is modest support for *targeted* revision: a separate pass for a named class of flaw, such as clichés, unnecessary exposition, tense slips or continuity. Open-ended "critique your own work and improve it" loops have no strong evidence for creative writing, and the next subsection gives reasons to distrust a model grading itself.

### Language models as judges of creative writing

- **Chakrabarty et al. 2024**, [Art or Artifice?](https://arxiv.org/abs/2309.14556) (CHI). Proposes the Torrance Test for Creative Writing (TTCW): 14 binary tests across fluency, flexibility, originality and elaboration, applied by 10 creative writers to 48 stories. Model stories passed 3 to 10 times fewer tests than professionally published stories. **None of the models tested as judges correlated positively with the expert assessments.**
- **Panickssery, Bowman and Feng 2024**, [LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/abs/2404.13076) (NeurIPS). Models rate their own outputs above equally good human or other-model text, and the bias grows with their ability to recognise their own text. This was shown on summarisation, not fiction.
- **Marco et al. 2024**, [Pron vs Prompt](https://arxiv.org/abs/2407.01119) (EMNLP). A novelist and GPT-4 each wrote stories to the same 30 titles, rated in 5,400 assessments by literary critics and scholars. The experts preferred the human writer on every dimension. GPT-4 wrote more creatively when given the human's titles than its own.
- Agents' Room (above) found only moderate item-level agreement between a model judge and human raters.

**Verdict.** Using a model as the *final* arbiter of literary quality is weakly supported and has known biases. It works better for checkable properties: does the chapter follow the outline, contradict the graph, switch tense, or contain a banned phrase.

### Homogenisation: models converge on the same stories

This is the most consistently replicated finding, across very different study designs:

- **Padmakumar and He 2024**, [Does Writing with Language Models Reduce Content Diversity?](https://arxiv.org/abs/2309.05196) (ICLR). Essays written with the feedback-tuned InstructGPT were significantly less diverse than those written alone. Writing with the base GPT-3 had no significant effect, which points at preference tuning.
- **Anderson, Shah and Kreminski 2024**, [Homogenization Effects of LLMs on Human Creative Ideation](https://arxiv.org/abs/2402.01536) (Creativity & Cognition). In a 36-participant study, ideas produced with ChatGPT were less distinct *across* users.
- **Doshi and Hauser 2024**, [Generative AI enhances individual creativity but reduces the collective diversity of novel content](https://pmc.ncbi.nlm.nih.gov/articles/PMC11244532) (Science Advances). A preregistered study with 293 writers and 600 evaluators. Model-supplied ideas made individual stories rate higher, but the stories were more similar to one another.
- **Xu et al. 2025**, [Echoes in AI](https://arxiv.org/abs/2501.00273) (PNAS). Plot elements recur across many generations of GPT-4 and LLaMA-3. Their "Sui Generis" score finds human plots more original, and the score correlates moderately with human judgements of surprise.
- **Hamilton and Mimno 2026**, [Elias in the Lighthouse, Again?](https://arxiv.org/abs/2605.26492). Across 20,000 stories from four current models, 11 words appear in 88.3% of stories, with little difference between models: names such as Elias, Mara and Elara, lighthouses, clockmakers, librarians. The authors trace these words to shared preference-tuning data. This is a recent preprint.
- **Russell et al. 2026**, [StoryScope](https://arxiv.org/abs/2604.03136). 61,608 stories of about 5,000 words, one human and five model stories per prompt. Model stories "over-explain themes", favour tidy single-track plots, are less morally ambiguous and less temporally complex, and cluster together in narrative space. Each model also has its own tells: one has flat escalation, one overuses dream sequences, one defaults to external character description. Narrative features alone separate human from model stories at 93% macro-F1. This is also a recent preprint.

**Verdict.** Strong. Expect a model's first instinct for a name, a setting, a twist or an ending to be the same instinct every other user gets. Counter-measures need to inject real variety: seeded randomness, constraints the reader chooses, a ban on default names and settings, or generating several options and picking the least typical. The plugin's no-existing-works rule rules out "variety by borrowing", so the variety has to come from structure and constraints.

### Continuity tracking

- **Ahuja, Sclar and Tsvetkov 2025**, [Finding Flawed Fictions](https://arxiv.org/abs/2504.11900) (COLM). Frontier models struggle to detect planted continuity errors, and get worse as stories get longer. Model-written summaries and adaptations introduced substantially *more* plot holes than the human originals.
- **Liu et al. 2024**, [Lost in the Middle](https://arxiv.org/abs/2307.03172) (TACL). Models use information at the start and end of a long context much better than information in the middle. This was shown on question answering, not fiction, but it applies to long manuscripts pasted into a prompt.
- Re3 and DOC both keep an explicit plan and story state outside the draft, rather than relying on the model to remember.

**Verdict.** Moderate and indirect. The evidence that models lose track of facts over long texts is solid. I found no controlled study showing that a knowledge graph in particular fixes this for fiction. External, structured memory that is checked on every chapter is the reasonable engineering response, not a proven one.

### Stock phrasing and how to remove it

- **Paech et al. 2025**, [Antislop](https://arxiv.org/abs/2510.15061) (ICLR 2026). Some "slop" patterns appear over 1,000 times more often in model text than in human text. Their backtracking sampler can suppress 8,000+ patterns, while plain token banning becomes unusable at about 2,000. Quality was partly judged by models. The [antislop-sampler README](https://github.com/sam-paech/antislop-sampler) gives examples such as "a tapestry of" and "a testament to".
- Wikipedia's editor-maintained guide [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) is practitioner consensus rather than research, and it is about encyclopedic prose, but many items carry over to fiction. It also warns that no single sign proves model authorship.

**Verdict.** The phrases are well documented, and post-hoc filtering or targeted editing removes them. Whether *telling* the model in the prompt not to use them works as well is not established; I found no controlled study.

### Overall: what is supported and what is folklore

- **Well supported.** Plan hierarchically before drafting. Keep plan and story state outside the draft. Expect homogenisation and design against it. Don't trust a model as the final judge of literary quality.
- **Moderately supported.** Targeted revision passes for named flaw classes. Explicit discourse structure in the prompt (arcs, turning points) to counter flat, uniformly positive stories. Multi-agent specialisation (one main study, small test set).
- **Folklore or unproven.** Open-ended self-critique loops for fiction. "You are a bestselling author" persona prompts. Self-scored 1-to-10 quality ratings. Prompt-only ban lists. Claims that one model family writes fiction much better than another (Chakrabarty et al. 2025 found no meaningful difference). And any claim about *novel-length* quality: no study has evaluated it with human readers.

---

## Avoid-list: overused motifs, stock phrases and tics in machine-written fiction

Each item gives its support. "Anecdotal" means writers and readers widely report it, but I found no study that measures it.

| Pattern | Examples | Support |
|---|---|---|
| Inflated abstract nouns | "a testament to", "a tapestry of", "a symphony of", "a kaleidoscope of" | [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); [antislop README](https://github.com/sam-paech/antislop-sampler) |
| "AI vocabulary" | delve, intricate, vibrant, pivotal, crucial, enduring, meticulous, showcase, underscore | Wikipedia guide (density matters more than any one word) |
| "Not X, but Y" constructions | "It wasn't fear, but something deeper." | Wikipedia ("negative parallelisms"); [slop-score](https://github.com/sam-paech/slop-score) weights it at 25% |
| Reflexive rule-of-three lists | three adjectives, three parallel clauses | Wikipedia ("rule of three") |
| Trailing significance clauses | "..., highlighting the bond between them" | Wikipedia ("superficial analyses") |
| Copula avoidance | "stood as", "served as" for "was" | Wikipedia |
| Default names and settings | Elara, Elias, Mara; lighthouses, clockmakers, librarians, keepers | [Hamilton & Mimno 2026](https://arxiv.org/abs/2605.26492) |
| Echoed plot elements | the same twist or set-piece across generations | [Xu et al., Echoes in AI](https://arxiv.org/abs/2501.00273) |
| Stated themes and closing morals | a chapter ending that explains what it all meant | [StoryScope](https://arxiv.org/abs/2604.03136) ("over-explain themes"); [Chakrabarty et al. 2025](https://arxiv.org/abs/2409.14509) ("unnecessary exposition") |
| Uniform positivity, low tension | everything resolves warmly; no real loss | [Tian et al. 2024](https://aclanthology.org/2024.emnlp-main.978) |
| Tidy single-track plots, flat escalation | no subplot pressure; stakes never rise | StoryScope |
| Dream sequences as a crutch | | StoryScope (model-specific) |
| Clichés and purple prose | "the heart of progress"; ornate description that calls attention to itself | Chakrabarty et al. 2025 (taxonomy categories) |
| Vague generalities | "a sense of something", no concrete detail | Chakrabarty et al. 2025 ("lack of specificity") |
| Hedged verbs | "seemed to amplify", "began to drift" for "amplified", "drifted" | Chakrabarty et al. 2025 ("awkward word choice", tense examples) |
| Tense slips | | Chakrabarty et al. 2025 |
| Em-dash overuse; elegant variation | | Wikipedia ("historical indicators") |
| Held breath | "let out a breath she didn't know she was holding" | Pre-AI cliché noted by copy chief [Benjamin Dreyer](https://benjamindreyer.substack.com/p/only-shifters-pad); anecdotal as an AI tic |
| Stock physical reactions | shivers down the spine, breath hitching, furrowed brows, eyes sparkling or twinkling, jaw clenching | Anecdotal |
| "The weight of" | "the weight of his words", "the weight of the moment" | Anecdotal |
| Whispered speech | "barely above a whisper" | Anecdotal |
| Every chapter a cliffhanger | | Craft: [Writing Excuses 21.30](https://writingexcuses.com/21-30-chapter-breaks-soon/) |
| Said-bookisms and adverbs on tags | "she breathed softly" | Craft: Elmore Leonard's rules |
| Exposition in dialogue | "As you know, ..." | Craft: [Writing Excuses 4.26](https://writingexcuses.com/writing-excuses-4-26-avoiding-stilted-dialog/) |

---

## Sources

**Structure**
- Brandon Sanderson, [2025 lecture 3: story structure](https://www.brandonsanderson.com/blogs/blog/brandon-sandersons-2025-overview-of-story-structure-lecture-3) (BYU course notes)
- Writing Excuses, [10.29 try-fail cycles](https://writingexcuses.com/writing-excuses-10-29-why-should-my-characters-fail-spectacularly/); [16.35 MICE](https://writingexcuses.com/16-35-what-is-the-m-i-c-e-quotient/); [6.10 MICE](https://writingexcuses.com/writing-excuses-6-10-scott-cards-m-i-c-e-quotient/)
- Jim Butcher, [LiveJournal craft posts](https://m.livejournal.com/read/user/jimbutcher/1262)
- Dwight V. Swain, *Techniques of the Selling Writer*, University of Oklahoma Press, 1965 ([catalogue](https://www.abebooks.com/9780806111919/Techniques-Selling-Writer-Swain-Dwight-0806111917/plp))
- Jack M. Bickham, *Scene & Structure*, Writer's Digest Books, 1993 ([listing](https://www.goodreads.com/book/show/190209))
- Orson Scott Card, *How to Write Science Fiction and Fantasy*, Writer's Digest Books, 1990 ([listing](https://goodreads.com/book/show/31363.How_to_Write_Science_Fiction___Fantasy))
- [Kishōtenketsu (Wikipedia)](https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu); Still Eating Oranges, ["The significance of plot without conflict"](https://www.downes.ca/post/58577/rd) (2012)
- Christopher Vogler, [1985 memo](https://ilacp.memberclicks.net/vogler-7-page-memo); [Hero's journey: criticism (Wikipedia)](https://en.wikipedia.org/wiki/Hero%27s_journey)

**Promises and payoff; foreshadowing and fair play**
- Brandon Sanderson, [2025 lecture 2: promise, progress, payoff](https://brandonsanderson.com/blogs/blog/brandon-sandersons-2025-guide-to-plot-lecture-2)
- [Chekhov's gun (Wikipedia, with letter citations)](https://en.wikipedia.org/wiki/Chekhov%27s_gun)
- S. S. Van Dine, ["Twenty Rules for Writing Detective Stories"](https://www.umsl.edu/~gradyf/film/vandinerules.htm) (1928); [Ronald Knox (Wikipedia)](https://en.wikipedia.org/wiki/Ronald_Knox)
- Caroline Crampton, [Shedunnit: "The Rules"](https://shedunnitshow.com/therulestranscript)

**Character and stakes**
- K. M. Weiland, [The lie](https://www.helpingwritersbecomeauthors.com/character-arcs-2/), [want vs need](https://www.helpingwritersbecomeauthors.com/character-arcs-3/), [the ghost](https://www.helpingwritersbecomeauthors.com/character-arcs-4/), [flat arcs](https://www.helpingwritersbecomeauthors.com/flat-character-arc-1/); *Creating Character Arcs* (2016, [listing](https://www.goodreads.com/book/show/32825587))
- John Truby, *The Anatomy of Story*, 2007 ([listing](https://www.goodreads.com/book/show/5216342))
- Robert McKee, *Story*, 1997 (summary by [Emily Short](https://emshort.blog/2019/02/05/story-robert-mckee/))
- Lisa Cron, *Wired for Story*, Ten Speed Press, 2012 ([listing](https://www.pw.org/node/885963))
- Donald Maass, *Writing the Breakout Novel*, 2001 ([listing](https://bookshop.org/ib/TheMixed-UpFiles/9781582971827))
- Writing Excuses, [18.46 raising the stakes](https://writingexcuses.com/18-46-nanowrimo-week-3-raising-the-stakes/)

**Worlds and magic**
- Brandon Sanderson, [First Law](https://brandonsanderson.com/sandersons-first-law/); [laws FAQ](https://faq.brandonsanderson.com/knowledge-base/what-are-sandersons-laws-of-magic/); [2025 lecture notes on the laws](https://www.brandonsanderson.com/blogs/blog/guide-to-sandersons-laws-of-magic-lecture-notes)
- Jo Walton, ["SF reading protocols"](https://reactormag.com/sf-reading-protocols/) (incluing), Reactor, 2010
- M. John Harrison on worldbuilding, [as quoted by Vector (BSFA)](https://vector-bsfa.com/2007/01/28/thought-for-the-day/), 2007
- Ursula K. Le Guin, ["From Elfland to Poughkeepsie"](https://en.wikipedia.org/wiki/From_Elfland_to_Poughkeepsie), 1973
- Ernest Hemingway, *Death in the Afternoon*, 1932 (iceberg principle)

**Point of view, voice, dialogue**
- Ursula K. Le Guin, *Steering the Craft*, 2015 ([review](https://kirkusreviews.com/book-reviews/ursula-k-le-guin/steering-the-craft/print))
- John Gardner, *The Art of Fiction*, 1983; [psychic distance (University of Nevada, Reno)](https://www.unr.edu/writing-speaking-center/student-resources/writing-speaking-resources/psychic-distance-in-creative-writing)
- Writing Excuses, [18.28](https://writingexcuses.com/18-28-writing-conversational-dialogue/), [10.38](https://writingexcuses.com/?p=4985), [4.26](https://writingexcuses.com/writing-excuses-4-26-avoiding-stilted-dialog/)
- Elmore Leonard, rules from the *New York Times*, 16 July 2001 ([reprint](https://csmonitor.com/Books/2008/0115/p16s01-bogn.html))

**Pacing, serials, revision**
- Writing Excuses, [21.30 chapter breaks](https://writingexcuses.com/21-30-chapter-breaks-soon/), [10.32 speed](https://writingexcuses.com/writing-excuses-10-32-how-do-i-control-the-speed-of-the-story/), [15.23 serialization](https://writingexcuses.com/15-23-serialization/), [5.29 rewriting](https://writingexcuses.com/writing-excuses-5-29-rewriting/)
- K. M. Weiland, [chapter cliffhangers](https://www.helpingwritersbecomeauthors.com/chapter-cliffhangers/)
- [Digital Dickens Notes Project](https://dickensnotes.org/introduction/general); [Victorian Web: Dickens' parts](https://victorianweb.org/victorian/authors/dickens/parts.html)
- Jane Friedman, [line editing, copy editing and proofreading](https://www.janefriedman.com/the-differences-between-line-editing-copy-editing-and-proofreading)
- Renni Browne and Dave King, *Self-Editing for Fiction Writers*, 2nd ed., 2004 ([publisher](https://www.harpercollins.ca/9780060545697/self-editing-for-fiction-writers-second-edition/))

**Language models and fiction**
- Fan et al. 2018, [Hierarchical Neural Story Generation](https://aclanthology.org/P18-1082/)
- Yao et al. 2019, [Plan-and-Write](https://arxiv.org/abs/1811.05701)
- Yang et al. 2022, [Re3](https://arxiv.org/abs/2210.06774); Yang et al. 2023, [DOC](https://aclanthology.org/2023.acl-long.190)
- Mirowski et al. 2023, [Dramatron](https://arxiv.org/abs/2209.14958)
- Huot et al. 2025, [Agents' Room](https://arxiv.org/abs/2410.02603)
- Bai et al. 2024, [LongWriter](https://arxiv.org/abs/2408.07055)
- Tian et al. 2024, [Human-Level Narratives?](https://aclanthology.org/2024.emnlp-main.978)
- Madaan et al. 2023, [Self-Refine](https://arxiv.org/abs/2303.17651); Huang et al. 2024, [Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798); Bae and Kim 2024, [CritiCS](https://arxiv.org/abs/2410.02428)
- Chakrabarty et al. 2024, [Art or Artifice?](https://arxiv.org/abs/2309.14556); Chakrabarty et al. 2025, [Can AI writing be salvaged?](https://arxiv.org/abs/2409.14509)
- Panickssery et al. 2024, [LLM Evaluators Favor Their Own Generations](https://arxiv.org/abs/2404.13076); Marco et al. 2024, [Pron vs Prompt](https://arxiv.org/abs/2407.01119)
- Padmakumar and He 2024, [Content Diversity](https://arxiv.org/abs/2309.05196); Anderson et al. 2024, [Homogenization Effects](https://arxiv.org/abs/2402.01536); Doshi and Hauser 2024, [Science Advances](https://pmc.ncbi.nlm.nih.gov/articles/PMC11244532); Xu et al. 2025, [Echoes in AI](https://arxiv.org/abs/2501.00273); Hamilton and Mimno 2026, [Elias in the Lighthouse, Again?](https://arxiv.org/abs/2605.26492); Russell et al. 2026, [StoryScope](https://arxiv.org/abs/2604.03136)
- Ahuja et al. 2025, [Finding Flawed Fictions](https://arxiv.org/abs/2504.11900); Liu et al. 2024, [Lost in the Middle](https://arxiv.org/abs/2307.03172)
- Paech et al. 2025, [Antislop](https://arxiv.org/abs/2510.15061); [antislop-sampler](https://github.com/sam-paech/antislop-sampler); [slop-score](https://github.com/sam-paech/slop-score); [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)

## What Storyteller does with this

Each practice above, and where it now lives in the plugin. "Prompt" means a function in `lib/prompts.js`; "stage" a step of a job in `lib/writer.js` (each its own request, saved before the next, so a crash repeats at most one); "check" something `lib/checks.js` or `lib/originality.js` counts without a model; "skill" a file in `skills/`.

| Practice | Where it lives |
|---|---|
| Plan before drafting, at several levels (§13, Re3, DOC, Dramatron) | The start is three stages: `world`, `cast`, `plot`. The plot prompt asks for the book's shape first (`structure`, `arcs` with chapter ranges and the turn that ends each), then threads, promises and twists, then one beat per chapter, each with `scenes` (goal, conflict, outcome) and a `hook`. Same number of requests as before: one plot request, more structured. |
| Structure models and when each fits (§1) | The plot prompt asks the model to name the shape it uses and why. One structure skill can be chosen to fix it: `try-fail-cycles`, `kishotenketsu`, `fair-clue-mystery`, `heist`. |
| Scene and sequel; goal, conflict, outcome; yes-but / no-and (§1) | Plot prompt (`PLOT_CRAFT`), the beat's `scenes`, the chapter's craft list (`CRAFT`), and check 3 of the revise prompt ("each scene has a goal, something in the way, and an outcome"). |
| MICE: close threads in reverse order (§1) | Threads carry a `kind` (milieu, inquiry, character, event) and `opened_in`/`closed_in`; the plot prompt says threads close in reverse order. `World.due` tells the chapter a thread is due to close. |
| Promises, progress, payoff (§2) | Promise nodes in the plan graph with `opened_in` and `pays_off_in`; the bible shows each as owed or kept; `World.due` lists those due in a chapter (and all still owed in the last); the update request marks them kept. The opening chapter's prompt asks for two or three promises about the kind of book. |
| Want, need, the lie, arcs, agency (§3) | The cast prompt asks for `lie`, `arc` (positive, flat or negative) and `agency` beside want and need; the plot prompt puts the lie under pressure in the middle and to a choice at the climax, won by the character's own act. |
| Character state after each chapter (§13, continuity) | The update request (quick model) returns `people` (where, learned, wants now, changed), `threads`, `when` and `questions`; `World.record` keeps them as notes on the person and thread nodes and as a `moment` node per chapter in the plan graph; `World.continuity` hands them to the next chapter and to the editor, apart from the bible so they are never what gets clipped. A branch cuts them back with the rest. |
| Stakes and escalation (§4) | Plot prompt: each movement raises the stakes; the middle tightens; the first plan fails by halfway for a reason in the world. |
| Fair twists, setup and payoff (§5) | Unchanged and still central: twists with seeds, planted at least two chapters before; `World.due` now also tells a chapter which seed to plant and which twist to reveal. Skill: `fair-clue-mystery`. |
| World rules with cost and limits; reader's understanding (§6) | World prompt: every rule has a `cost`, a `limit` and a `shown_by` moment; at most five coined words; plain names preferred. Chapter craft: at most two new invented terms a chapter, each shown in use first. Revise check 5 (clarity). Skill: `clear-inventions`. |
| Point of view, voice, tense (§7) | The book's `voice` is set in the world stage (and must agree with a chosen style or voice skill); the chapter keeps to it; revise check 2. Skills: `second-person`, `present-tense`, `spare-concrete`, `lush-lyrical`, `wry`. |
| Dialogue (§8) | Chapter craft list; each character's `voice` in the cast; the editor is given the cast's voices. Skill: `dialogue-subtext`. |
| Pacing and chapter endings (§9) | Each beat has a `hook`; chapter craft: end on the turn, a question open, no summary or moral; revise check 4. Skill: `chapter-hooks`. |
| Serial fiction: re-anchoring, recaps, continuity (§11) | Chapter craft: re-anchor whose scene, where and when in the first lines, without a recap; continuity block; the "questions the reader is carrying" from the last chapter. |
| Revision: what editors check (§12) and targeted critique-then-revise (§13) | The `revise` stage: one request per chapter, a nine-item checklist of concrete, checkable things (not a quality score, since models are poor judges of quality), answered with edits that `Writer.applyEdits` places only where the passage occurs once. What is good is left alone. Setting `revise` turns it off; `model_revise` picks the model. |
| Stock phrasing and machine tics (§13, avoid-list) | `Checks.findings` counts the stock phrases (`Prompts.STOCK`), phrases used three times, phrases taken over from the previous chapter's end, and overused motifs, and hands the counts to the editor as facts to fix: a list in the prompt alone is weak evidence, detection plus targeted edits is better supported. Skills: `cut-the-slop`, `trust-the-reader`. |
| Homogenisation across stories (§13) | The world prompt lists the furniture models fall back on (`Prompts.MOTIFS`: tides, ledgers, clerks, lighthouses, quince and the rest) and the names they reach for first; `Checks.leanedOn` counts what the reader's earlier stories leaned on and the new story is told to stay away, in the world request and in every chapter (`premise.avoid`). |
| Models as judges (§13) | Nowhere is a model asked to score a chapter. The revise checklist and the skill evals' graders are concrete statements answered with quoted evidence, and the evals compare with a run without the skill, not with an absolute score. |
| Originality | Unchanged: the rule in every request, the forbidden-names check on every world, plan and chapter (now after the editor's pass, so it sees the final text). Skills are checked too and refused when they name an author, ask for imitation or try to override the rules; what passes is sent as material in its own block below the rules. |

