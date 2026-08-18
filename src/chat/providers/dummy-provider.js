const RESPONSE_RULES = [
  {
    pattern: /(疲|しんど|つかれ|無理)/,
    replies: [
      "おつかれさま。今は一口水を飲んで、肩の力を抜いてみよう。",
      "ちょっと頑張りすぎかも。一分だけ目を閉じてもいいんだよ。",
    ],
  },
  {
    pattern: /(こんにちは|おはよ|やあ|こんばんは)/,
    replies: [
      "やっほー、Mochiだよ。今日もそばにいるね！",
      "こんにちは！話しかけてくれてうれしいな。",
    ],
  },
  {
    pattern: /(ありがと|サンキュ|感謝)/,
    replies: [
      "どういたしまして！またいつでも呼んでね。",
      "えへへ、役に立ててうれしい！",
    ],
  },
];

const DEFAULT_REPLIES = [
  "うんうん、ちゃんと聞いてるよ。もう少し教えて？",
  "それ、面白いね。Mochiと一緒に少しずつ考えよう。",
  "ここにいるから、焦らなくて大丈夫だよ。",
];

function pick(items, seed) {
  const total = [...seed].reduce((sum, char) => sum + char.codePointAt(0), 0);
  return items[total % items.length];
}

export class DummyProvider {
  id = "dummy";
  label = "Dummy";

  async complete(messages) {
    const latest = [...messages].reverse().find((message) => message.role === "user");
    const prompt = latest?.content ?? "";
    const rule = RESPONSE_RULES.find(({ pattern }) => pattern.test(prompt));
    const content = pick(rule?.replies ?? DEFAULT_REPLIES, prompt);

    await new Promise((resolve) => setTimeout(resolve, 420));
    return { content, provider: this.id, model: "local-rules" };
  }
}
