-- Optional cleanup for databases that ran the original seed.
-- Keep existing records for recovery; never change real product prices.
update public.products
set active = false, featured = false
where id in ('gennaro-patrono', 'gennaro-ampolla', 'diego-capitano', 'diego-divisa-bianca', 'pulcinella', 'cornetto')
   or category in ('maschere', 'fortuna')
   or image ~* '\.svg([?#]|$)';
