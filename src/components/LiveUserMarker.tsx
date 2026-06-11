type Props = {
  isSelf?: boolean;
};

export default function LiveUserMarker({ isSelf }: Props) {
  return (
    <div className="relative flex h-6 w-6 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22FF66] opacity-50" />
      <span
        className={`relative h-4 w-4 rounded-full border-2 border-white ${
          isSelf ? "bg-[#22FF66]" : "bg-[#10B981]"
        }`}
        style={{ boxShadow: "0 0 12px #22FF66" }}
      />
    </div>
  );
}