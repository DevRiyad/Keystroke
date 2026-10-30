// Public-domain passages (plain ASCII punctuation so every keyboard layout can type them).
export interface Quote {
  text: string
  source: string
}

export const QUOTES: Quote[] = [
  {
    source: 'Jane Austen, Pride and Prejudice (1813)',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
  },
  {
    source: 'Herman Melville, Moby-Dick (1851)',
    text: 'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.',
  },
  {
    source: 'Abraham Lincoln, Gettysburg Address (1863)',
    text: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.',
  },
  {
    source: 'Henry David Thoreau, Walden (1854)',
    text: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.',
  },
  {
    source: 'Charles Dickens, A Tale of Two Cities (1859)',
    text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity.',
  },
]
