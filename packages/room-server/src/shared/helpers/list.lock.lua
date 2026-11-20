local acquired = {}
for _, key in ipairs(KEYS) do
  if redis.call('SET', key, ARGV[1], 'NX', 'PX', ARGV[2]) then
    acquired[#acquired + 1] = key
  else
    for _, acquiredKey in ipairs(acquired) do
      redis.call('DEL', acquiredKey)
    end
    return 0
  end
end
return 1
