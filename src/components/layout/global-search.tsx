"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  Loader2,
  Package,
  Search,
  Ticket,
  User,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

type IconComponent = React.ComponentType<{ className?: string }>;

const TYPE_CONFIG: Record<string, { label: string; Icon: IconComponent }> = {
  project:  { label: "Projects",        Icon: Briefcase },
  task:     { label: "Tasks",           Icon: CheckSquare },
  employee: { label: "Employees",       Icon: User },
  asset:    { label: "IT Assets",       Icon: Package },
  license:  { label: "Licenses",        Icon: FileText },
  gap:      { label: "Gaps",            Icon: AlertTriangle },
  company:  { label: "Companies",       Icon: Building2 },
  ticket:   { label: "Support Tickets", Icon: Ticket },
};

const DISPLAY_ORDER = ["project", "employee", "task", "asset", "license", "gap", "company", "ticket"];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const activeTypes = DISPLAY_ORDER.filter((t) => grouped[t]?.length);

  function select(href: string) {
    router.push(href);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden w-full max-w-sm items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent md:flex"
        aria-label="Open global search (Ctrl+K)"
      >
        <Search className="h-4 w-4 shrink-0 opacity-70" />
        <span className="flex-1 text-left">Search everything...</span>
        <kbd className="pointer-events-none flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 [&>button]:hidden">
          <Command shouldFilter={false} className="rounded-lg">
            <CommandInput
              placeholder="Search projects, employees, assets, tasks..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}

              {!loading && query.length < 2 && (
                <CommandEmpty>
                  Type at least 2 characters to search across all records.
                </CommandEmpty>
              )}

              {!loading && query.length >= 2 && results.length === 0 && (
                <CommandEmpty>No results found for &ldquo;{query}&rdquo;</CommandEmpty>
              )}

              {!loading &&
                activeTypes.map((type, index) => {
                  const { label, Icon } = TYPE_CONFIG[type];
                  return (
                    <Fragment key={type}>
                      {index > 0 && <CommandSeparator />}
                      <CommandGroup heading={label}>
                        {grouped[type].map((result) => (
                          <CommandItem
                            key={`${type}-${result.id}`}
                            value={`${type}-${result.id}`}
                            onSelect={() => select(result.href)}
                            className="flex cursor-pointer items-start gap-3 py-2.5"
                          >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium leading-snug">
                                {result.title}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {result.subtitle}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Fragment>
                  );
                })}
            </CommandList>

            {!loading && results.length > 0 && (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                {results.length} result{results.length !== 1 ? "s" : ""} — showing up to 5 per category
              </div>
            )}
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
