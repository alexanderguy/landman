#!/usr/bin/env bun

import { Command } from "commander"
import { searchCommand } from "./commands/search"
import { listCommand } from "./commands/list"
import { showCommand } from "./commands/show"
import { profileCommand } from "./commands/profile"
import { mergeCommand } from "./commands/merge"
import { exportCommand } from "./commands/export"
import { configCommand } from "./commands/config"
import { monitorCommand } from "./commands/monitor"

const program = new Command()

program
  .name("landbot")
  .description("Property search and monitoring tool")
  .version("0.1.0")

program.addCommand(searchCommand)
program.addCommand(listCommand)
program.addCommand(showCommand)
program.addCommand(profileCommand)
program.addCommand(mergeCommand)
program.addCommand(exportCommand)
program.addCommand(configCommand)
program.addCommand(monitorCommand)

program.parse()
