import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    description: "Say hello",
  },
  args: {
    name: {
      type: "positional",
      description: "Name to greet",
      required: false,
    },
  },
  run({ args }) {
    console.log(`Hello, ${args.name || "world"}!`);
  },
});
