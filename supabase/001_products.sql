create table if not exists public.products (
 id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'), name text not null,
 category text not null check(category in ('santi','calcio','maschere','fortuna')),
 price numeric(10,2) not null check(price >= 0 and price <= 100000),
 image text not null, description text not null default '', details text not null default '',
 badge text not null default '', purchase_url text not null default '',
 active boolean not null default true, featured boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select, insert, update, delete on public.products to service_role;
-- Access is exclusively through the server: no public write policy.
insert into public.products (id,name,category,price,image,description,details,badge,purchase_url,active,featured) values
('gennaro-patrono','San Gennaro, il Patrono','santi',129,'assets/img/gennaro-patrono.svg','Il vescovo di Napoli con mitra dorata e ampolla del sangue, modellato al tornio e rifinito a mano. Un pezzo da altare di casa.','Altezza 28 cm, 1,1 kg, ceramica smaltata dipinta a mano.','Il più amato','',true,false),
('gennaro-ampolla','San Gennaro, l''Ampolla','santi',69,'assets/img/gennaro-ampolla.svg','La versione compatta con mantello azzurro e ampolla in evidenza. Perfetta su una mensola, in auto o come pensiero per chi parte.','Altezza 16 cm, 420 g, ceramica smaltata dipinta a mano.','','',true,false),
('diego-capitano','El Diez, il Capitano','calcio',119,'assets/img/diego-capitano.svg','Maglia azzurra con il numero 10, braccio al cielo e pallone ai piedi. Pezzo numerato e firmato dal ceramista sotto la base.','Altezza 25 cm, 950 g, ceramica smaltata dipinta a mano.','Edizione limitata','',true,false),
('diego-divisa-bianca','El Diez, la Divisa Bianca','calcio',79,'assets/img/diego-divisa-bianca.svg','La stessa posa in formato da scrivania con maglia bianca e pantaloncini azzurri. Il regalo giusto per chi il calcio lo vive a Napoli.','Altezza 18 cm, 520 g, ceramica smaltata dipinta a mano.','','',true,false),
('pulcinella','Pulcinella, la Maschera','maschere',74,'assets/img/pulcinella.svg','Camicione bianco, bottoni neri e mezza maschera con il naso lungo. La più antica maschera di Napoli, dipinta con un pennello a punta fine.','Altezza 22 cm, 780 g, ceramica smaltata dipinta a mano.','','',true,false),
('cornetto','Il Cornetto Portafortuna','fortuna',29,'assets/img/cornetto.svg','Rosso corallo, con le nervature scavate a mano e la fascia in oro. Contro il malocchio e per augurare buona fortuna.','Altezza 12 cm, 230 g, ceramica smaltata dipinta a mano.','Regalo ideale','',true,false),
('d10s-oro','D10S','calcio',16.99,'assets/img/maradonaOro.jpeg','Diego Armando, il Numero 10.','','','https://www.vinted.it/member/253373573',true,true),
('san-gennaro-oro','San Gennaro','santi',14.99,'assets/img/sanGennaroOro.jpeg','Il patrono della città più bella del mondo.','','','https://www.vinted.it/member/253373573',true,true)
on conflict (id) do nothing;
